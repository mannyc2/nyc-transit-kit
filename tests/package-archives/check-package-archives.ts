import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

type DependencyGroup =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies"

type PackageJson = {
  readonly name?: string
  readonly private?: boolean
  readonly exports?: unknown
  readonly files?: ReadonlyArray<string>
  readonly dependencies?: Record<string, string>
  readonly devDependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
  readonly optionalDependencies?: Record<string, string>
}

type PackFile = {
  readonly path: string
  readonly size: number
  readonly file: File
}

type CatalogDefinitions = {
  readonly defaultCatalog: Record<string, string>
  readonly namedCatalogs: ReadonlyMap<string, Record<string, string>>
}

type SourceCatalogDependency = {
  readonly group: DependencyGroup
  readonly dependencyName: string
}

const rootPath = new URL("../../", import.meta.url).pathname
const packageRoot = join(rootPath, "packages")
const dependencyGroups: ReadonlyArray<DependencyGroup> = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
]
const secretLikePatterns: ReadonlyArray<RegExp> = [
  /\b[A-Z][A-Z0-9_]*(?:API_KEY|AUTH_TOKEN|ACCESS_TOKEN|SECRET|PASSWORD|PRIVATE_KEY|TOKEN)[A-Z0-9_]*\s*=\s*["']?[^"'\s]{8,}/,
  /"(?:apiKey|api_key|authToken|auth_token|accessToken|access_token|secret|password|privateKey|private_key|token)"\s*:\s*"[^"]{8,}"/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/
]
const privatePathPatterns: ReadonlyArray<RegExp> = [
  /\/home\/[A-Za-z0-9._-]+\//,
  /\/Users\/[A-Za-z0-9._-]+\//,
  /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/
]
const normalVersionPattern = /^(?:[\^~])?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const stringRecord = (value: unknown): Record<string, string> => {
  const result: Record<string, string> = {}
  if (!isRecord(value)) {
    return result
  }

  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested === "string") {
      result[key] = nested
    }
  }

  return result
}

const dependencyRecord = (
  manifest: PackageJson | Record<string, unknown>,
  group: DependencyGroup
) => stringRecord(manifest[group])

const readPackageJson = async (path: string) => {
  const text = await Bun.file(path).text()
  const manifest: PackageJson = JSON.parse(text)
  return { manifest, text }
}

const readRootCatalogDefinitions = async (): Promise<CatalogDefinitions> => {
  const parsed: unknown = JSON.parse(await Bun.file(join(rootPath, "package.json")).text())
  const rootManifest = isRecord(parsed) ? parsed : {}
  const workspaces = isRecord(rootManifest.workspaces) ? rootManifest.workspaces : {}
  const catalogs = isRecord(workspaces.catalogs) ? workspaces.catalogs : {}
  const namedCatalogs = new Map<string, Record<string, string>>()

  for (const [catalogName, catalog] of Object.entries(catalogs)) {
    namedCatalogs.set(catalogName, stringRecord(catalog))
  }

  return {
    defaultCatalog: stringRecord(workspaces.catalog),
    namedCatalogs
  }
}

const packageManifestPaths = async () => {
  const entries = await readdir(packageRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packageRoot, entry.name, "package.json"))
}

const collectStringTargets = (value: unknown): ReadonlyArray<string> => {
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

const exportEntries = (manifest: PackageJson) => {
  const exportsValue = manifest.exports
  if (!isRecord(exportsValue)) {
    return []
  }

  return Object.entries(exportsValue).map(([key, value]) => ({
    key,
    targets: collectStringTargets(value)
  }))
}

const packageArchivePath = async (tempDirectory: string, stdout: string) => {
  const outputPath = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .findLast((line) => line.endsWith(".tgz"))

  if (outputPath !== undefined) {
    return outputPath.startsWith("/") ? outputPath : join(tempDirectory, outputPath)
  }

  const entries = await readdir(tempDirectory)
  const archiveName = entries.find((entry) => entry.endsWith(".tgz"))
  if (archiveName !== undefined) {
    return join(tempDirectory, archiveName)
  }

  throw new Error("bun pm pack did not report or write a .tgz archive")
}

const normalizePackedPath = (path: string) =>
  path.startsWith("package/") ? path.slice("package/".length) : path

const packArchiveFiles = async (packageDirectory: string): Promise<ReadonlyArray<PackFile>> => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "ntk-pack-"))

  try {
    const proc = Bun.spawn(
      ["bun", "pm", "pack", "--quiet", "--ignore-scripts", "--destination", tempDirectory],
      {
        cwd: packageDirectory,
        stderr: "pipe",
        stdout: "pipe"
      }
    )
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      throw new Error(`bun pm pack failed for ${packageDirectory}\n${stderr}`)
    }

    const archivePath = await packageArchivePath(tempDirectory, stdout)
    const archive = new Bun.Archive(await Bun.file(archivePath).arrayBuffer())
    const entries = await archive.files()
    const packFiles: Array<PackFile> = []

    for (const [path, file] of entries) {
      packFiles.push({
        path: normalizePackedPath(path),
        size: file.size,
        file
      })
    }

    return packFiles
  } finally {
    await rm(tempDirectory, {
      recursive: true,
      force: true
    })
  }
}

const isUnsafeArchivePath = (path: string) =>
  path.includes("node_modules") ||
  path === ".env" ||
  path.startsWith(".env/") ||
  path.startsWith(".env.") ||
  path.includes(".github") ||
  path.startsWith("/") ||
  path.includes("..") ||
  path.endsWith(".map")

const isTextPackFile = (path: string) =>
  /\.(?:cjs|csv|cts|d\.ts|js|json|jsx|md|mjs|mts|ts|tsx|txt|yaml|yml)$/.test(path) ||
  path === "LICENSE" ||
  path === "README.md" ||
  path === "package.json"

const isInternalDependency = (dependencyName: string) =>
  dependencyName.startsWith("@nyc-transit-kit/")

const catalogForSpec = (catalogs: CatalogDefinitions, version: string) => {
  const catalogName = version.slice("catalog:".length).trim()
  if (catalogName.length === 0) {
    return catalogs.defaultCatalog
  }

  return catalogs.namedCatalogs.get(catalogName)
}

const catalogLabel = (version: string) => {
  const catalogName = version.slice("catalog:".length).trim()
  return catalogName.length === 0 ? "default catalog" : `catalog:${catalogName}`
}

const validateSourceDependencySpec = (
  label: string,
  dependencyName: string,
  version: string,
  catalogs: CatalogDefinitions
) => {
  if (dependencyName.startsWith("@bp/")) {
    failures.push(`${label}: depends on downstream-private package ${dependencyName}`)
  }
  if (version.startsWith("workspace:")) {
    failures.push(`${label}: ${dependencyName} uses a workspace dependency`)
  }
  if (version.startsWith("catalog:")) {
    const catalog = catalogForSpec(catalogs, version)
    if (isInternalDependency(dependencyName)) {
      failures.push(`${label}: ${dependencyName} uses a catalog dependency`)
    } else if (catalog === undefined) {
      failures.push(`${label}: ${dependencyName} uses unknown ${catalogLabel(version)}`)
    } else if (catalog[dependencyName] === undefined) {
      failures.push(`${label}: ${dependencyName} is not defined in ${catalogLabel(version)}`)
    }
  }
  if (version.startsWith("file:")) {
    failures.push(`${label}: ${dependencyName} uses a file dependency`)
  }
  if (version.includes(rootPath) || version.startsWith("/") || version.startsWith("..")) {
    failures.push(`${label}: ${dependencyName} uses a local path dependency`)
  }
}

const scanPackedDependencySpecs = (label: string, manifest: Record<string, unknown>) => {
  for (const group of dependencyGroups) {
    const dependencies = dependencyRecord(manifest, group)
    for (const [dependencyName, version] of Object.entries(dependencies)) {
      if (dependencyName.startsWith("@bp/")) {
        failures.push(`${label}: packed package.json depends on ${dependencyName}`)
      }
      if (version.startsWith("workspace:")) {
        failures.push(`${label}: packed package.json ${dependencyName} uses workspace:`)
      }
      if (version.startsWith("catalog:")) {
        failures.push(`${label}: packed package.json ${dependencyName} uses catalog:`)
      }
      if (version.startsWith("file:")) {
        failures.push(`${label}: packed package.json ${dependencyName} uses file:`)
      }
      if (version.includes(rootPath) || version.startsWith("/") || version.startsWith("..")) {
        failures.push(`${label}: packed package.json ${dependencyName} uses a local path`)
      }
    }
  }
}

const readPackedPackageManifest = async (
  label: string,
  packFiles: ReadonlyArray<PackFile>
): Promise<Record<string, unknown> | undefined> => {
  const packageJsonFile = packFiles.find((file) => file.path === "package.json")
  if (packageJsonFile === undefined) {
    failures.push(`${label}: archive dry run did not include package.json`)
    return undefined
  }

  const parsed: unknown = JSON.parse(await packageJsonFile.file.text())
  if (!isRecord(parsed)) {
    failures.push(`${label}: packed package.json did not contain an object`)
    return undefined
  }

  return parsed
}

const scanPackFileContent = async (label: string, packFiles: ReadonlyArray<PackFile>) => {
  for (const file of packFiles) {
    if (!isTextPackFile(file.path)) {
      continue
    }

    const content = await file.file.text()
    if (
      content.includes(rootPath) ||
      privatePathPatterns.some((pattern) => pattern.test(content))
    ) {
      failures.push(`${label}: archive file ${file.path} contains a private absolute path`)
    }
    if (secretLikePatterns.some((pattern) => pattern.test(content))) {
      failures.push(`${label}: archive file ${file.path} contains a secret-like value`)
    }
    if (file.path.endsWith(".map") && content.includes(rootPath)) {
      failures.push(`${label}: source map ${file.path} contains a local absolute path`)
    }
  }
}

const failures: Array<string> = []
const catalogs = await readRootCatalogDefinitions()
let sawSourceCatalogEffectDependency = false
let sawPackedCatalogEffectResolution = false

for (const manifestPath of await packageManifestPaths()) {
  const packageDirectory = manifestPath.replace(/\/package\.json$/, "")
  const { manifest, text } = await readPackageJson(manifestPath)
  const label = manifest.name ?? manifestPath.replace(rootPath, "")
  const sourceCatalogDependencies: Array<SourceCatalogDependency> = []

  if (manifest.private === true) {
    failures.push(`${label}: publishable packages must not be private`)
  }

  if (text.includes(rootPath)) {
    failures.push(`${label}: package manifest contains a local absolute path`)
  }

  for (const fileEntry of manifest.files ?? []) {
    if (isUnsafeArchivePath(fileEntry)) {
      failures.push(`${label}: files includes unsafe archive entry ${fileEntry}`)
    }
  }

  for (const group of dependencyGroups) {
    const dependencies = dependencyRecord(manifest, group)
    for (const [dependencyName, version] of Object.entries(dependencies)) {
      if (version.startsWith("catalog:")) {
        sourceCatalogDependencies.push({
          group,
          dependencyName
        })
        if (dependencyName === "effect") {
          sawSourceCatalogEffectDependency = true
        }
      }
      validateSourceDependencySpec(label, dependencyName, version, catalogs)
    }
  }

  const packFiles = await packArchiveFiles(packageDirectory)
  const packedPaths = new Set(packFiles.map((file) => file.path))
  for (const file of packFiles) {
    if (isUnsafeArchivePath(file.path)) {
      failures.push(`${label}: archive includes unsafe entry ${file.path}`)
    }
  }
  await scanPackFileContent(label, packFiles)

  const packedManifest = await readPackedPackageManifest(label, packFiles)
  if (packedManifest !== undefined) {
    scanPackedDependencySpecs(label, packedManifest)
    for (const dependency of sourceCatalogDependencies) {
      const packedVersion = dependencyRecord(packedManifest, dependency.group)[
        dependency.dependencyName
      ]
      if (packedVersion === undefined) {
        failures.push(
          `${label}: packed package.json missing catalog-backed ${dependency.dependencyName}`
        )
      }
      if (
        dependency.dependencyName === "effect" &&
        normalVersionPattern.test(packedVersion ?? "")
      ) {
        sawPackedCatalogEffectResolution = true
      }
    }
  }

  for (const { key, targets } of exportEntries(manifest)) {
    for (const target of targets) {
      if (!target.startsWith("./")) {
        failures.push(`${label}: export ${key} target ${target} is not relative`)
        continue
      }

      const archivePath = target.slice(2)
      if (archivePath.startsWith("dist/")) {
        failures.push(`${label}: export ${key} target ${target} points at dist`)
      }
      if (!(await Bun.file(join(packageDirectory, archivePath)).exists())) {
        failures.push(`${label}: export ${key} target ${target} does not exist`)
      }
      if (!packedPaths.has(archivePath)) {
        failures.push(`${label}: export ${key} target ${target} is not included in package archive`)
      }
    }
  }
}

if (!sawSourceCatalogEffectDependency) {
  failures.push("no source package manifest uses catalog: for effect")
}
if (!sawPackedCatalogEffectResolution) {
  failures.push("no packed package manifest resolved catalog-backed effect to a normal version")
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exit(1)
}

console.log("Package archive preflight passed.")
