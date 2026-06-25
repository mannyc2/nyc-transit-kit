import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, extname, join } from "node:path"
import type { CoverageProvider } from "../../scripts/provider-descriptor-shared"

export const rootPath = new URL("../../", import.meta.url).pathname
export const packageRoot = join(rootPath, "packages")
export const expectedPackages = [
  "contracts",
  "soda3",
  "mta",
  "nyc-open-data",
  "nyc-dot",
  "cli",
  "compat",
  "fixtures"
]

export const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"])
export const soda3GuardExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".txt",
  ".csv"
])
export const expectedEffectVersion = "4.0.0-beta.83"
export const expectedEffectToolingVersions: Record<string, string> = {
  "@effect/language-service": "0.86.2"
}
export const expectedRootToolingCatalogVersions: Record<string, string> = {
  "@biomejs/biome": "2.5.0",
  "@types/bun": "1.3.14",
  typescript: "6.0.3"
}
export const dependencyGroups = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
]
export const subpathExportPackages = new Set([
  "contracts",
  "soda3",
  "mta",
  "nyc-open-data",
  "nyc-dot",
  "compat"
])
export const rootImportPattern = /from\s+["'](@nyc-transit-kit\/[^/"']+)["']/g

export const isInternalSourceFile = (file: string) => file.includes("/src/internal/")
export const isEffectToolingPackage = (dependencyName: string) =>
  expectedEffectToolingVersions[dependencyName] !== undefined
export const isEffectRuntimePackage = (dependencyName: string) =>
  dependencyName === "effect" ||
  (dependencyName.startsWith("@effect/") && !isEffectToolingPackage(dependencyName))
export const stringValue = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}
export const isCatalogReference = (value: unknown) =>
  typeof value === "string" && value.startsWith("catalog:")
export const uniqueSortedStrings = (values: ReadonlyArray<string>) =>
  [...new Set(values)].toSorted()

export const walkFiles = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return walkFiles(path)
      }
      return [path]
    })
  )

  return nested.flat()
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export const readJsonRecord = async (path: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(parsed)) {
    throw new Error(`${path} did not contain a JSON object`)
  }
  return parsed
}

export const collectStringTargets = (value: unknown): ReadonlyArray<string> => {
  const targets: Array<string> = []
  const visit = (candidate: unknown) => {
    if (typeof candidate === "string") {
      targets.push(candidate)
      return
    }
    if (isRecord(candidate)) {
      for (const nested of Object.values(candidate)) {
        visit(nested)
      }
    }
  }
  visit(value)
  return targets
}

export const exportEntries = (manifest: Record<string, unknown>) => {
  const exportsValue = manifest.exports
  if (!isRecord(exportsValue)) {
    return []
  }

  return Object.entries(exportsValue).map(([key, value]) => ({
    key,
    targets: collectStringTargets(value)
  }))
}

export const packageCodeFiles = async (packageDirectory: string) =>
  (await walkFiles(join(packageRoot, packageDirectory)))
    .filter((file) => !file.includes("/dist/"))
    .filter((file) => file.includes("/src/") || file.includes("/scripts/"))
    .filter((file) => sourceExtensions.has(extname(file)))

export const packagePublicSourceFiles = async (packageDirectoryPath: string) =>
  (await walkFiles(join(packageDirectoryPath, "src")))
    .filter((file) => sourceExtensions.has(extname(file)))
    .filter((file) => !isInternalSourceFile(file))
    .filter((file) => basename(file) !== "index.ts")

export const runProviderCoverageCheck = async (provider: CoverageProvider, input: unknown) => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "ntk-provider-coverage-"))

  try {
    const inputPath = join(tempDirectory, `${provider}.json`)
    await Bun.write(inputPath, JSON.stringify(input))
    const proc = Bun.spawn(
      [
        "bun",
        "run",
        "scripts/check-provider-coverage.ts",
        "--provider",
        provider,
        "--input",
        inputPath
      ],
      {
        cwd: rootPath,
        stderr: "pipe",
        stdout: "pipe"
      }
    )
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited
    const parsed: unknown = JSON.parse(stdout)

    return {
      exitCode,
      json: parsed,
      stderr,
      stdout
    }
  } finally {
    await rm(tempDirectory, {
      recursive: true,
      force: true
    })
  }
}
