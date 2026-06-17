import { describe, expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const rootPath = new URL("../../", import.meta.url).pathname
const packageRoot = join(rootPath, "packages")
const apiReferencePath = join(rootPath, "docs", "api-reference.md")
const providerCoveragePath = join(rootPath, "docs", "provider-coverage.md")
const readmePath = join(rootPath, "README.md")
const cliRuntimePath = join(rootPath, "packages", "cli", "src", "runtime.ts")
const tsconfigBasePath = join(rootPath, "tsconfig.base.json")

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const readJsonRecord = async (path: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(parsed)) {
    throw new Error(`${path} did not contain a JSON object`)
  }
  return parsed
}

const publicExportKeys = (manifest: Record<string, unknown>) => {
  const exportsValue = manifest.exports
  if (!isRecord(exportsValue)) {
    return []
  }

  return Object.keys(exportsValue)
}

const packageManifests = async () => {
  const entries = await readdir(packageRoot, { withFileTypes: true })
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const manifest = await readJsonRecord(join(packageRoot, entry.name, "package.json"))
        const packageName = manifest.name
        if (typeof packageName !== "string") {
          throw new Error(`${entry.name} package.json is missing name`)
        }
        return {
          packageName,
          exports: publicExportKeys(manifest)
        }
      })
  )
}

const importPathFor = (packageName: string, exportKey: string) =>
  exportKey === "." ? packageName : `${packageName}/${exportKey.slice(2)}`

const typeScriptFences = (source: string) =>
  [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((match) => match[1] ?? "")

const cliEnvVars = (source: string) =>
  [...source.matchAll(/\benv\.([A-Z][A-Z0-9_]*)\b/g)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined)

const typecheckTypeScriptFences = async (fences: ReadonlyArray<string>) => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "ntk-docs-examples-"))

  try {
    const baseTsconfig = await readJsonRecord(tsconfigBasePath)
    const compilerOptions = isRecord(baseTsconfig.compilerOptions)
      ? baseTsconfig.compilerOptions
      : {}
    const paths = isRecord(compilerOptions.paths) ? compilerOptions.paths : {}
    const files = await Promise.all(
      fences.map(async (fence, index) => {
        const path = join(tempDirectory, `api-reference-example-${index + 1}.ts`)
        await Bun.write(path, fence)
        return path
      })
    )
    const tsconfigPath = join(tempDirectory, "tsconfig.json")
    await Bun.write(
      tsconfigPath,
      JSON.stringify(
        {
          extends: tsconfigBasePath,
          compilerOptions: {
            declaration: false,
            declarationMap: false,
            emitDeclarationOnly: false,
            noEmit: true,
            baseUrl: rootPath,
            paths: {
              ...paths,
              effect: [
                "node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/index.d.ts"
              ],
              "effect/*": ["node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/*.d.ts"]
            },
            typeRoots: [join(rootPath, "node_modules", "@types")]
          },
          files
        },
        null,
        2
      )
    )
    const proc = Bun.spawn(["bun", "run", "tsc", "--project", tsconfigPath, "--pretty", "false"], {
      cwd: rootPath,
      stderr: "pipe",
      stdout: "pipe"
    })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      throw new Error(
        [
          "API reference TypeScript examples failed to typecheck.",
          `Generated files: ${files.join(", ")}`,
          stdout.trim(),
          stderr.trim()
        ]
          .filter((line) => line.length > 0)
          .join("\n")
      )
    }
  } finally {
    await rm(tempDirectory, {
      recursive: true,
      force: true
    })
  }
}

const importSmokeCases: ReadonlyArray<{
  readonly importPath: string
  readonly packageDirectory: string
  readonly exports: ReadonlyArray<string>
}> = [
  {
    importPath: "@nyc-transit-kit/soda3/client",
    packageDirectory: "soda3",
    exports: ["queryRows", "Soda3ClientConfig", "Soda3HttpLive"]
  },
  {
    importPath: "@nyc-transit-kit/soda3/endpoints",
    packageDirectory: "soda3",
    exports: ["buildQueryUrl", "buildExportUrl"]
  },
  {
    importPath: "@nyc-transit-kit/contracts/descriptor-registry",
    packageDirectory: "contracts",
    exports: ["makeDescriptorRegistry"]
  },
  {
    importPath: "@nyc-transit-kit/mta/gtfs-static",
    packageDirectory: "mta",
    exports: ["probeGtfsStatic", "fetchGtfsStatic", "MtaHttpLive"]
  },
  {
    importPath: "@nyc-transit-kit/mta/gtfs-realtime",
    packageDirectory: "mta",
    exports: ["probeGtfsRealtime", "GtfsRealtimeDecoder"]
  },
  {
    importPath: "@nyc-transit-kit/mta/feeds",
    packageDirectory: "mta",
    exports: ["mtaGtfsStaticFeeds", "mtaGtfsRealtimeFeeds", "findMtaGtfsRealtimeFeed"]
  },
  {
    importPath: "@nyc-transit-kit/nyc-open-data/client",
    packageDirectory: "nyc-open-data",
    exports: ["queryNycOpenDataDataset", "exportNycOpenDataDataset"]
  },
  {
    importPath: "@nyc-transit-kit/nyc-dot/client",
    packageDirectory: "nyc-dot",
    exports: ["queryNycDotDataset", "exportNycDotDataset"]
  },
  {
    importPath: "@nyc-transit-kit/compat/nyc-dot",
    packageDirectory: "compat",
    exports: ["queryNycDotRows"]
  },
  {
    importPath: "@nyc-transit-kit/contracts/soda3",
    packageDirectory: "contracts",
    exports: ["Soda3QueryRequest", "Soda3QueryResponse"]
  }
]

const exportedNamesFromPublicImport = async (
  importPath: string,
  packageDirectory: string
): Promise<ReadonlyArray<string>> => {
  const proc = Bun.spawn(
    [
      "bun",
      "-e",
      `const imported = await import(${JSON.stringify(importPath)}); console.log(JSON.stringify(Object.keys(imported)))`
    ],
    {
      cwd: join(packageRoot, packageDirectory),
      stderr: "pipe",
      stdout: "pipe"
    }
  )
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`${importPath} failed to import: ${stderr.trim()}`)
  }
  const parsed: unknown = JSON.parse(stdout)
  if (!Array.isArray(parsed)) {
    throw new Error(`${importPath} did not print exported names`)
  }
  return parsed.filter((value): value is string => typeof value === "string")
}

describe("API reference docs", () => {
  test("mentions every public package export path", async () => {
    const source = await Bun.file(apiReferencePath).text()
    const missing: Array<string> = []

    for (const manifest of await packageManifests()) {
      for (const exportKey of manifest.exports) {
        const importPath = importPathFor(manifest.packageName, exportKey)
        if (!source.includes(importPath)) {
          missing.push(importPath)
        }
      }
    }

    expect(missing).toEqual([])
  })

  test("documents exports that importable subpaths actually expose", async () => {
    const missing: Array<string> = []

    for (const smoke of importSmokeCases) {
      const exportedNames = new Set(
        await exportedNamesFromPublicImport(smoke.importPath, smoke.packageDirectory)
      )

      for (const exportName of smoke.exports) {
        if (!exportedNames.has(exportName)) {
          missing.push(`${smoke.importPath}: missing ${exportName}`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  test("uses package subpath imports in TypeScript examples", async () => {
    const manifests = await packageManifests()
    const packagesWithSubpaths = manifests
      .filter((manifest) => manifest.exports.some((exportKey) => exportKey !== "."))
      .map((manifest) => manifest.packageName)
    const offenders: Array<string> = []

    for (const [index, fence] of typeScriptFences(
      await Bun.file(apiReferencePath).text()
    ).entries()) {
      for (const packageName of packagesWithSubpaths) {
        const rootImportPattern = new RegExp(
          `(?:from\\s+["']${packageName}["']|import\\(\\s*["']${packageName}["']\\s*\\))`
        )
        if (rootImportPattern.test(fence)) {
          offenders.push(`code fence ${index + 1}: imports ${packageName} root`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test("does not include legacy Socrata endpoint examples", async () => {
    const offenders = typeScriptFences(await Bun.file(apiReferencePath).text())
      .map((fence, index) => ({ fence, index }))
      .filter(({ fence }) => fence.includes("/resource/"))
      .map(({ index }) => `code fence ${index + 1}`)

    expect(offenders).toEqual([])
  })

  test("documents CLI environment variables", async () => {
    const runtimeSource = await Bun.file(cliRuntimePath).text()
    const readme = await Bun.file(readmePath).text()
    const apiReference = await Bun.file(apiReferencePath).text()
    const missing: Array<string> = []

    for (const variable of cliEnvVars(runtimeSource)) {
      if (!readme.includes(variable)) {
        missing.push(`README.md: ${variable}`)
      }
      if (!apiReference.includes(variable)) {
        missing.push(`docs/api-reference.md: ${variable}`)
      }
    }

    expect(missing).toEqual([])
  })

  test("links the provider coverage policy from public docs", async () => {
    const readme = await Bun.file(readmePath).text()
    const apiReference = await Bun.file(apiReferencePath).text()
    const providerCoverage = await Bun.file(providerCoveragePath).text()

    expect(readme).toContain("docs/provider-coverage.md")
    expect(apiReference).toContain("provider-coverage.md")
    expect(providerCoverage).toContain("Generic coverage")
    expect(providerCoverage).toContain("Rejected For v0")
  })

  test("typechecks TypeScript examples", async () => {
    await typecheckTypeScriptFences(typeScriptFences(await Bun.file(apiReferencePath).text()))
  })
})
