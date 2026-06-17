import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

type JsonRecord = Record<string, unknown>

const rootPath = new URL("../", import.meta.url).pathname
const packageRoot = join(rootPath, "packages")
const stageRoot = join(rootPath, ".release/npm")
const artifactsRoot = join(rootPath, ".release/artifacts")
const releaseRepository = "mannyc2/nyc-transit-kit"
const dependencyGroups = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
]

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringField = (record: JsonRecord, key: string) => {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

const stringArray = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const readJsonRecord = async (path: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(parsed)) {
    throw new Error(`${path} did not contain a JSON object`)
  }
  return parsed
}

const writeJson = async (path: string, value: JsonRecord) =>
  Bun.write(path, `${JSON.stringify(value, null, 2)}\n`)

const packageDirectories = async () => {
  const entries = await readdir(packageRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()
}

const streamText = async (stream: ReadableStream<Uint8Array> | null) =>
  stream === null ? "" : await new Response(stream).text()

const runCommand = async (
  command: ReadonlyArray<string>,
  options: { readonly cwd?: string | undefined } = {}
) => {
  const proc = Bun.spawn([...command], {
    cwd: options.cwd,
    stderr: "pipe",
    stdout: "pipe"
  })
  const stdout = await streamText(proc.stdout)
  const stderr = await streamText(proc.stderr)
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(
      [`Command failed: ${command.join(" ")}`, stdout.trim(), stderr.trim()]
        .filter((line) => line.length > 0)
        .join("\n")
    )
  }
  return { stdout, stderr }
}

const packageArchivePath = async (directory: string, stdout: string) => {
  const fromStdout = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".tgz"))
    .findLast((line) => line.length > 0)

  if (fromStdout !== undefined) {
    return fromStdout.startsWith("/") ? fromStdout : join(directory, fromStdout)
  }

  const entries = await readdir(directory)
  const archive = entries.find((entry) => entry.endsWith(".tgz"))
  if (archive !== undefined) {
    return join(directory, archive)
  }

  throw new Error(`No package archive found in ${directory}`)
}

const normalizePackedPath = (path: string) =>
  path.startsWith("package/") ? path.slice("package/".length) : path

const extractArchive = async (archivePath: string, destination: string) => {
  const archive = new Bun.Archive(await Bun.file(archivePath).arrayBuffer())
  const files = await archive.files()

  for (const [path, file] of files) {
    const normalized = normalizePackedPath(path)
    if (
      normalized.length === 0 ||
      normalized.startsWith("/") ||
      normalized.split("/").includes("..")
    ) {
      throw new Error(`Unsafe archive path: ${path}`)
    }
    const destinationPath = join(destination, normalized)
    await mkdir(dirname(destinationPath), { recursive: true })
    await Bun.write(destinationPath, file)
  }
}

const packageTarballName = (packageName: string, version: string) =>
  `${packageName.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`

const addFileEntries = (manifest: JsonRecord, entries: ReadonlyArray<string>) => {
  const files = new Set(stringArray(manifest.files))
  for (const entry of entries) {
    files.add(entry)
  }
  manifest.files = [...files].toSorted()
}

const addReleaseMetadata = (
  manifest: JsonRecord,
  packageDirectory: string,
  releaseVersion: string
) => {
  const packageName = stringField(manifest, "name")
  if (packageName === undefined) {
    throw new Error(`${packageDirectory}: package manifest is missing name`)
  }

  manifest.version = releaseVersion
  manifest.license = "MIT"
  manifest.repository = {
    type: "git",
    url: `git+https://github.com/${releaseRepository}.git`,
    directory: `packages/${packageDirectory}`
  }
  manifest.homepage = `https://github.com/${releaseRepository}#readme`
  manifest.bugs = {
    url: `https://github.com/${releaseRepository}/issues`
  }
  manifest.keywords = ["bun", "effect", "mta", "nyc", "socrata", "transit"]
  manifest.engines = {
    ...(isRecord(manifest.engines) ? manifest.engines : {}),
    bun: ">=1.3.14"
  }
  manifest.publishConfig = {
    ...(isRecord(manifest.publishConfig) ? manifest.publishConfig : {}),
    access: "public"
  }

  for (const group of dependencyGroups) {
    const dependencies = manifest[group]
    if (!isRecord(dependencies)) {
      continue
    }
    for (const dependencyName of Object.keys(dependencies)) {
      if (dependencyName.startsWith("@nyc-transit-kit/")) {
        dependencies[dependencyName] = releaseVersion
      }
    }
  }

  addFileEntries(manifest, ["LICENSE", "README.md"])
}

const writePackageReadme = async (stageDirectory: string, packageName: string) =>
  Bun.write(
    join(stageDirectory, "README.md"),
    [
      `# ${packageName}`,
      "",
      "Part of `nyc-transit-kit`, an Effect-native Bun toolkit for official NYC and MTA transit data APIs.",
      "",
      "See the repository README and docs/api-reference.md for public import paths, CLI commands, and release notes.",
      ""
    ].join("\n")
  )

const stageCliBinWrappers = async (stageDirectory: string, manifest: JsonRecord) => {
  const binDirectory = join(stageDirectory, "bin")
  await mkdir(binDirectory, { recursive: true })
  const wrapper = [
    "#!/usr/bin/env bun",
    'import { main } from "../src/main.ts"',
    "await main()",
    ""
  ].join("\n")
  await Bun.write(join(binDirectory, "ntk"), wrapper)
  await Bun.write(join(binDirectory, "nyc-transit"), wrapper)
  manifest.bin = {
    ntk: "./bin/ntk",
    "nyc-transit": "./bin/nyc-transit"
  }
  addFileEntries(manifest, ["bin"])
}

await runCommand(["bun", "run", "release:version:check"], { cwd: rootPath })

const rootManifest = await readJsonRecord(join(rootPath, "package.json"))
const releaseVersion = stringField(rootManifest, "version")
if (releaseVersion === undefined) {
  throw new Error("Root package.json is missing version")
}

await rm(stageRoot, { recursive: true, force: true })
await rm(artifactsRoot, { recursive: true, force: true })
await mkdir(stageRoot, { recursive: true })
await mkdir(artifactsRoot, { recursive: true })

const staged: Array<{
  readonly package: string
  readonly path: string
  readonly tarball: string
  readonly version: string
}> = []

for (const packageDirectory of await packageDirectories()) {
  const packagePath = join(packageRoot, packageDirectory)
  const stageDirectory = join(stageRoot, packageDirectory)
  const tempDirectory = await mkdtemp(join(tmpdir(), "ntk-source-pack-"))

  try {
    const { stdout } = await runCommand(
      ["bun", "pm", "pack", "--quiet", "--ignore-scripts", "--destination", tempDirectory],
      { cwd: packagePath }
    )
    const archivePath = await packageArchivePath(tempDirectory, stdout)
    await mkdir(stageDirectory, { recursive: true })
    await extractArchive(archivePath, stageDirectory)
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }

  const manifestPath = join(stageDirectory, "package.json")
  const manifest = await readJsonRecord(manifestPath)
  const packageName = stringField(manifest, "name")
  if (packageName === undefined) {
    throw new Error(`${packageDirectory}: staged package is missing name`)
  }

  addReleaseMetadata(manifest, packageDirectory, releaseVersion)
  if (packageDirectory === "cli") {
    await stageCliBinWrappers(stageDirectory, manifest)
  }
  await copyFile(join(rootPath, "LICENSE"), join(stageDirectory, "LICENSE"))
  await writePackageReadme(stageDirectory, packageName)
  await writeJson(manifestPath, manifest)

  await runCommand(["npm", "pack", "--json", "--pack-destination", artifactsRoot, stageDirectory], {
    cwd: rootPath
  })

  staged.push({
    package: packageName,
    path: stageDirectory.replace(rootPath, ""),
    tarball: join(".release/artifacts", packageTarballName(packageName, releaseVersion)),
    version: releaseVersion
  })
}

console.log(JSON.stringify({ version: releaseVersion, staged }, null, 2))
