import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, relative } from "node:path"
import * as Schema from "effect/Schema"

export const rootPath = new URL("../../", import.meta.url).pathname

/** Apps deploy; packages are libraries. */
export const apps = ["cli"]
export const packages = ["fixtures", "mta", "nyc-open-data", "soda3"]

export interface Workspace {
  readonly name: string
  readonly kind: "app" | "package"
  readonly path: string
}

export const workspaces: ReadonlyArray<Workspace> = [
  ...apps.map((name) => ({ name, kind: "app" as const, path: join(rootPath, "apps", name) })),
  ...packages.map((name) => ({
    name,
    kind: "package" as const,
    path: join(rootPath, "packages", name)
  }))
]

/** Internal packages each workspace may depend on at run time. Dependencies point down, never up. */
export const allowedInternalDependencies: Readonly<Record<string, ReadonlyArray<string>>> = {
  fixtures: [],
  soda3: [],
  mta: ["soda3"],
  "nyc-open-data": ["soda3"],
  cli: ["soda3", "mta", "nyc-open-data"]
}

export const expectedEffectVersion = "4.0.6"
/** Libraries accept any 4.x from the pinned one up, so an app has one copy of Effect. */
export const expectedEffectPeerRange = "^4.0.6"
export const expectedEffectToolingVersions: Readonly<Record<string, string>> = {
  "@effect/language-service": "0.87.5"
}
export const expectedRootToolingCatalogVersions: Readonly<Record<string, string>> = {
  "@biomejs/biome": "2.5.0",
  "@types/bun": "1.3.14",
  typescript: "6.0.3",
  vitest: "5.0.5"
}

export const dependencyGroups = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const

const Dependencies = Schema.Record(Schema.String, Schema.String)

/** The parts of a package.json these checks read. */
export const Manifest = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  private: Schema.optionalKey(Schema.Boolean),
  bin: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  exports: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  files: Schema.optionalKey(Schema.Array(Schema.String)),
  scripts: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  /** The root manifest's: the workspace globs and the dependency catalogs. */
  workspaces: Schema.optionalKey(
    Schema.Struct({
      packages: Schema.Array(Schema.String),
      catalog: Schema.optionalKey(Dependencies),
      catalogs: Schema.optionalKey(Schema.Record(Schema.String, Dependencies))
    })
  ),
  dependencies: Schema.optionalKey(Dependencies),
  devDependencies: Schema.optionalKey(Dependencies),
  peerDependencies: Schema.optionalKey(Dependencies),
  optionalDependencies: Schema.optionalKey(Dependencies)
})
export type Manifest = typeof Manifest.Type

const decodeManifest = Schema.decodeUnknownSync(Schema.fromJsonString(Manifest))

export const readManifest = async (directory: string) =>
  decodeManifest(await Bun.file(join(directory, "package.json")).text())

export const isEffectToolingPackage = (name: string) =>
  expectedEffectToolingVersions[name] !== undefined
export const isEffectRuntimePackage = (name: string) =>
  name === "effect" || (name.startsWith("@effect/") && !isEffectToolingPackage(name))

/** Files under `directory`, skipping installed and built ones. */
export const walkFiles = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== "node_modules" && entry.name !== "dist")
      .map((entry) => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? walkFiles(path) : Promise.resolve([path])
      })
  )
  return nested.flat()
}

const isCode = (file: string) => file.endsWith(".ts")

/** A workspace's TypeScript in the given folders. */
export const codeFiles = async (
  workspace: Workspace,
  folders: ReadonlyArray<string> = ["src", "scripts", "test"]
) =>
  (await Promise.all(folders.map((folder) => walkFiles(join(workspace.path, folder)))))
    .flat()
    .filter(isCode)

/** Top-level modules of `src`, by name: `Soql` for `src/Soql.ts`. */
export const moduleNames = async (workspace: Workspace) =>
  (await readdir(join(workspace.path, "src"), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && isCode(entry.name))
    .map((entry) => basename(entry.name, ".ts"))
    .filter((name) => name !== "index" && name !== "bin")
    .toSorted()

export const display = (file: string) => relative(rootPath, file)

/**
 * Runs a root script in a temporary directory: `args` writes its inputs there
 * and names them, and `read` collects what it wrote before the directory goes.
 */
export const runScript = async <A>(
  script: string,
  args: (directory: string) => Promise<ReadonlyArray<string>>,
  read: (directory: string) => Promise<A> = async () => undefined as A
) => {
  const directory = await mkdtemp(join(tmpdir(), "ntk-script-"))
  try {
    const proc = Bun.spawn(["bun", "run", script, ...(await args(directory))], {
      cwd: rootPath,
      stderr: "pipe",
      stdout: "pipe"
    })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited
    return { exitCode, stdout, stderr, output: await read(directory) }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export const runProviderCoverageCheck = async (provider: string, input: unknown) => {
  const result = await runScript("scripts/check-provider-coverage.ts", async (directory) => {
    const inputPath = join(directory, `${provider}.json`)
    await Bun.write(inputPath, JSON.stringify(input))
    return ["--provider", provider, "--input", inputPath]
  })
  const json: unknown = JSON.parse(result.stdout)
  return { exitCode: result.exitCode, json, stderr: result.stderr }
}
