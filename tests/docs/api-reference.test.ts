import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { readManifest, rootPath, workspaces } from "../architecture/helpers"

const read = (path: string) => Bun.file(join(rootPath, path)).text()

const importPath = (packageName: string, exportKey: string) =>
  exportKey === "." ? packageName : `${packageName}/${exportKey.slice(2)}`

/** Every public import path, with the source file it resolves to. */
const publicImports = async () =>
  (
    await Promise.all(
      workspaces.map(async (workspace) => {
        const manifest = await readManifest(workspace.path)
        return Object.entries(manifest.exports ?? {}).map(([key, target]) => ({
          workspace,
          path: importPath(manifest.name, key),
          file: join(workspace.path, target)
        }))
      })
    )
  ).flat()

/** Every TypeScript block in the READMEs and docs/, which must compile against the current code. */
const typeScriptFences = async () => {
  const docs = (await readdir(join(rootPath, "docs"))).filter((name) => name.endsWith(".md"))
  const sources = [
    "README.md",
    ...docs.toSorted().map((name) => `docs/${name}`),
    ...workspaces.map((workspace) => `${workspace.path.slice(rootPath.length)}/README.md`)
  ]
  const fences = await Promise.all(
    sources.map(async (source) =>
      [...(await read(source)).matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map(
        (match, index) => ({ source, index: index + 1, code: match[1] ?? "" })
      )
    )
  )
  return fences.flat()
}

// The CLI reads its environment through effect/Config, as in Config.Redacted("SOCRATA_APP_TOKEN").
const cliEnvironmentVariables = async () => {
  const sources = join(rootPath, "apps", "cli", "src")
  const variables = new Set<string>()
  for (const file of await readdir(sources, { recursive: true })) {
    if (file.endsWith(".ts")) {
      const source = await Bun.file(join(sources, file)).text()
      for (const [, name] of source.matchAll(/\bConfig\.\w+\(\s*"([A-Z][A-Z0-9_]*)"/g)) {
        if (name !== undefined) variables.add(name)
      }
    }
  }
  return [...variables]
}

/** What each public module must export: the names the docs teach. */
const documentedExports: Readonly<Record<string, ReadonlyArray<string>>> = {
  "@nyc-transit-kit/soda3": ["Dataset", "Discovery", "Socrata", "Soda3Client", "Soql"],
  "@nyc-transit-kit/soda3/Soda3Client": [
    "Soda3Client",
    "layer",
    "streamRows",
    "countRows",
    "viewUrl"
  ],
  "@nyc-transit-kit/soda3/Dataset": ["query", "stream", "exportBytes"],
  "@nyc-transit-kit/soda3/Discovery": ["search", "metadata", "columns", "url", "DatasetNotFound"],
  "@nyc-transit-kit/soda3/Socrata": [
    "SocrataDomain",
    "SocrataDatasetId",
    "SocrataError",
    "datasetUrl",
    "filterStatusOk"
  ],
  "@nyc-transit-kit/soda3/Soql": [
    "soql",
    "compile",
    "eq",
    "isIn",
    "isNotNull",
    "and",
    "or",
    "selectAll",
    "monthWindow",
    "monthRange",
    "dateWindow",
    "timestampRange",
    "yearMonthRange",
    "SoqlError"
  ],
  "@nyc-transit-kit/mta": [
    "BusTime",
    "ElevatorEscalator",
    "GtfsRealtime",
    "GtfsStatic",
    "MtaOpenData"
  ],
  "@nyc-transit-kit/mta/GtfsStatic": ["feeds", "probe", "stream"],
  "@nyc-transit-kit/mta/GtfsRealtime": [
    "feeds",
    "decode",
    "toJson",
    "summarize",
    "fetchBytes",
    "fetchMessage",
    "capture",
    "CaptureManifest",
    "GtfsRealtimeDecodeError"
  ],
  "@nyc-transit-kit/mta/ElevatorEscalator": ["feeds", "fetchRows", "Outage", "Equipment"],
  "@nyc-transit-kit/mta/BusTime": ["feeds", "fetchJson"],
  "@nyc-transit-kit/mta/MtaOpenData": ["domain", "datasets", "CatalogRow"],
  "@nyc-transit-kit/nyc-open-data": ["NycDot", "NycOpenData"],
  "@nyc-transit-kit/nyc-open-data/NycDot": [
    "datasets",
    "TrafficSpeedRow",
    "BusLaneRow",
    "TrafficVolumeRow"
  ],
  "@nyc-transit-kit/nyc-open-data/NycOpenData": ["domain", "datasets"],
  "@nyc-transit-kit/fixtures": ["HttpTest", "Samples"],
  "@nyc-transit-kit/fixtures/HttpTest": ["layer", "soda3", "requests", "Requests"],
  "@nyc-transit-kit/fixtures/Samples": [
    "trafficSpeedRows",
    "soda3AuthenticationRequired",
    "statenIslandRailwayFeed",
    "lirrAlertsFeed"
  ],
  "@nyc-transit-kit/cli": ["Cli", "Envelope", "ReleaseManifest"],
  "@nyc-transit-kit/cli/Cli": ["run", "command"],
  "@nyc-transit-kit/cli/Envelope": ["Envelope", "ApiFamily", "schemaVersion"],
  "@nyc-transit-kit/cli/ReleaseManifest": ["ReleaseManifest", "Artifact"]
}

/** Imports each path the way a consumer would, from inside its own package, and lists its names. */
const exportedNames = async (directory: string, paths: ReadonlyArray<string>) => {
  const script = `const names = {}
for (const path of ${JSON.stringify(paths)}) names[path] = Object.keys(await import(path))
console.log(JSON.stringify(names))`
  const proc = Bun.spawn(["bun", "-e", script], { cwd: directory, stderr: "pipe", stdout: "pipe" })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  if ((await proc.exited) !== 0) {
    throw new Error(`importing from ${directory} failed: ${stderr.trim()}`)
  }
  const names: Record<string, ReadonlyArray<string>> = JSON.parse(stdout)
  return names
}

const typecheck = async (fences: ReadonlyArray<{ readonly code: string }>) => {
  const directory = await mkdtemp(join(tmpdir(), "ntk-docs-examples-"))
  try {
    const files = await Promise.all(
      fences.map(async (fence, index) => {
        const path = join(directory, `example-${index}.ts`)
        await Bun.write(path, fence.code)
        return path
      })
    )
    const nodeModules = join(rootPath, "node_modules")
    const platformBun = join(rootPath, "apps", "cli", "node_modules", "@effect", "platform-bun")
    // Examples import packages by their public paths, resolved here to the sources they name.
    const paths: Record<string, ReadonlyArray<string>> = {
      effect: [join(nodeModules, "effect", "dist", "index.d.ts")],
      "effect/*": [join(nodeModules, "effect", "dist", "*.d.ts")],
      "@effect/platform-bun/*": [join(platformBun, "dist", "*.d.ts")],
      "@effect/vitest": [join(nodeModules, "@effect", "vitest", "dist", "index.d.ts")]
    }
    for (const entry of await publicImports()) {
      paths[entry.path] = [entry.file]
    }
    const tsconfig = join(directory, "tsconfig.json")
    await Bun.write(
      tsconfig,
      JSON.stringify({
        extends: join(rootPath, "tsconfig.json"),
        compilerOptions: { paths, typeRoots: [join(nodeModules, "@types")], plugins: [] },
        include: [],
        files
      })
    )
    const proc = Bun.spawn(["bun", "run", "tsc", "--project", tsconfig, "--pretty", "false"], {
      cwd: rootPath,
      stderr: "pipe",
      stdout: "pipe"
    })
    const output =
      (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text())
    return { exitCode: await proc.exited, output, files }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe("API reference", () => {
  it("mentions every public import path", async () => {
    const reference = await read("docs/api-reference.md")
    const missing = (await publicImports())
      .map((entry) => entry.path)
      .filter((path) => !reference.includes(path))
    expect(missing).toEqual([])
  })

  it("teaches names the public modules export", { timeout: 30_000 }, async () => {
    const imports = await publicImports()
    expect(Object.keys(documentedExports).toSorted()).toEqual(
      imports.map((entry) => entry.path).toSorted()
    )
    const missing: Array<string> = []
    for (const workspace of workspaces) {
      const paths = imports
        .filter((entry) => entry.workspace === workspace)
        .map((entry) => entry.path)
      const names = await exportedNames(workspace.path, paths)
      for (const path of paths) {
        const exported = new Set(names[path])
        for (const name of documentedExports[path] ?? []) {
          if (!exported.has(name)) missing.push(`${path}: missing ${name}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it("documents the CLI's environment variables", async () => {
    const variables = await cliEnvironmentVariables()
    expect(variables).toContain("SOCRATA_APP_TOKEN")
    const missing: Array<string> = []
    for (const source of ["README.md", "docs/api-reference.md"]) {
      const text = await read(source)
      for (const variable of variables) {
        if (!text.includes(variable)) missing.push(`${source}: ${variable}`)
      }
    }
    expect(missing).toEqual([])
  })

  it("links the provider coverage policy from public docs", async () => {
    expect(await read("README.md")).toContain("docs/provider-coverage.md")
    expect(await read("docs/api-reference.md")).toContain("provider-coverage.md")
    const coverage = await read("docs/provider-coverage.md")
    expect(coverage).toContain("Generic coverage")
    expect(coverage).toContain("Rejected For v0")
  })
})

describe("examples", () => {
  it("import packages by subpath and never reach SODA2", async () => {
    const offenders: Array<string> = []
    for (const fence of await typeScriptFences()) {
      if (/(?:from\s+|import\(\s*)["']@nyc-transit-kit\/[^/"']+["']/.test(fence.code)) {
        offenders.push(`${fence.source} example ${fence.index}: imports a package root`)
      }
      if (fence.code.includes("/resource/")) {
        offenders.push(`${fence.source} example ${fence.index}: uses a SODA2 URL`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("typecheck against the current code", { timeout: 60_000 }, async () => {
    const fences = await typeScriptFences()
    expect(fences.length).toBeGreaterThan(0)
    const result = await typecheck(fences)
    const located = result.files.reduce((output, file, index) => {
      const fence = fences[index]
      const name = `${fence?.source} example ${fence?.index}`
      // tsc names files relative to where it runs.
      return output.replaceAll(relative(rootPath, file), name).replaceAll(file, name)
    }, result.output)
    expect(located.trim()).toBe("")
    expect(result.exitCode).toBe(0)
  })
})
