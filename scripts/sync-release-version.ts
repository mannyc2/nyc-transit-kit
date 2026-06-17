import { readdir } from "node:fs/promises"
import { join } from "node:path"

type JsonRecord = Record<string, unknown>

const rootPath = new URL("../", import.meta.url).pathname
const packageRoot = join(rootPath, "packages")
const metadataPath = join(rootPath, "packages/contracts/src/metadata.ts")
const dependencyGroups = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
]
const semverPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
const checkOnly = Bun.argv.includes("--check")

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readJsonRecord = async (path: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(parsed)) {
    throw new Error(`${path} did not contain a JSON object`)
  }
  return parsed
}

const writeJson = async (path: string, value: JsonRecord) =>
  Bun.write(path, `${JSON.stringify(value, null, 2)}\n`)

const packageManifestPaths = async () => {
  const entries = await readdir(packageRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packageRoot, entry.name, "package.json"))
    .toSorted()
}

const stringField = (record: JsonRecord, key: string) => {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

const setStringField = (record: JsonRecord, key: string, value: string) => {
  if (record[key] === value) {
    return false
  }
  record[key] = value
  return true
}

const syncManifest = (manifest: JsonRecord, releaseVersion: string) => {
  let changed = setStringField(manifest, "version", releaseVersion)

  for (const group of dependencyGroups) {
    const dependencies = manifest[group]
    if (!isRecord(dependencies)) {
      continue
    }
    for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
      if (!dependencyName.startsWith("@nyc-transit-kit/")) {
        continue
      }
      if (dependencyVersion !== releaseVersion) {
        dependencies[dependencyName] = releaseVersion
        changed = true
      }
    }
  }

  return changed
}

const manifestFailures = (
  label: string,
  manifest: JsonRecord,
  releaseVersion: string
): ReadonlyArray<string> => {
  const failures: Array<string> = []
  if (stringField(manifest, "version") !== releaseVersion) {
    failures.push(`${label}: version must be ${releaseVersion}`)
  }
  for (const group of dependencyGroups) {
    const dependencies = manifest[group]
    if (!isRecord(dependencies)) {
      continue
    }
    for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
      if (dependencyName.startsWith("@nyc-transit-kit/") && dependencyVersion !== releaseVersion) {
        failures.push(`${label}: ${group}.${dependencyName} must be ${releaseVersion}`)
      }
    }
  }
  return failures
}

const syncMetadataSource = (source: string, releaseVersion: string) => {
  const nextLine = `export const releaseVersion = "${releaseVersion}"`
  if (/export const releaseVersion = "[^"]+"/.test(source)) {
    return source.replace(/export const releaseVersion = "[^"]+"/, nextLine)
  }
  return source.replace(
    /export const schemaVersion = "[^"]+"\n/,
    (match) => `${match}${nextLine}\n`
  )
}

const rootManifestPath = join(rootPath, "package.json")
const rootManifest = await readJsonRecord(rootManifestPath)
const releaseVersion = stringField(rootManifest, "version")

if (releaseVersion === undefined || !semverPattern.test(releaseVersion)) {
  console.error("Root package.json version must be a normal semver version.")
  process.exit(1)
}

const failures: Array<string> = []
const writes: Array<Promise<unknown>> = []

for (const manifestPath of [rootManifestPath, ...(await packageManifestPaths())]) {
  const manifest = await readJsonRecord(manifestPath)
  const label = manifestPath.replace(rootPath, "")

  if (checkOnly) {
    failures.push(...manifestFailures(label, manifest, releaseVersion))
    continue
  }

  if (syncManifest(manifest, releaseVersion)) {
    writes.push(writeJson(manifestPath, manifest))
  }
}

const metadataSource = await Bun.file(metadataPath).text()
const nextMetadataSource = syncMetadataSource(metadataSource, releaseVersion)

if (checkOnly) {
  if (metadataSource !== nextMetadataSource) {
    failures.push("packages/contracts/src/metadata.ts: releaseVersion is out of sync")
  }
} else if (metadataSource !== nextMetadataSource) {
  writes.push(Bun.write(metadataPath, nextMetadataSource))
}

await Promise.all(writes)

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exit(1)
}

if (checkOnly) {
  console.log(`Release version ${releaseVersion} is synchronized.`)
} else {
  console.log(`Synchronized release version ${releaseVersion}.`)
}
