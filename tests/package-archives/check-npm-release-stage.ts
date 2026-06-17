import { readdir } from "node:fs/promises"
import { join } from "node:path"

type JsonRecord = Record<string, unknown>

const rootPath = new URL("../../", import.meta.url).pathname
const packageRoot = join(rootPath, "packages")
const stageRoot = join(rootPath, ".release/npm")
const artifactsRoot = join(rootPath, ".release/artifacts")
const dependencyGroups = [
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
  /\/mnt\/models\/dev\//,
  /\/home\/[A-Za-z0-9._-]+\//,
  /\/Users\/[A-Za-z0-9._-]+\//,
  /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/
]

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringField = (record: JsonRecord, key: string) => {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

const readJsonRecord = async (path: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(parsed)) {
    throw new Error(`${path} did not contain a JSON object`)
  }
  return parsed
}

const packageDirectories = async () => {
  const entries = await readdir(packageRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()
}

const walkFiles = async (directory: string): Promise<ReadonlyArray<string>> => {
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

const streamText = async (stream: ReadableStream<Uint8Array> | null) =>
  stream === null ? "" : await new Response(stream).text()

const runCommand = async (command: ReadonlyArray<string>) => {
  const proc = Bun.spawn([...command], {
    cwd: rootPath,
    stderr: "pipe",
    stdout: "pipe"
  })
  const stdout = await streamText(proc.stdout)
  const stderr = await streamText(proc.stderr)
  const exitCode = await proc.exited
  return { exitCode, stdout, stderr }
}

const packageTarballName = (packageName: string, version: string) =>
  `${packageName.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`

const isUnsafeSpec = (value: string) =>
  value.startsWith("workspace:") ||
  value.startsWith("catalog:") ||
  value.startsWith("file:") ||
  value.startsWith("/") ||
  value.startsWith("..") ||
  value.includes(rootPath) ||
  value.includes("/mnt/models/dev/")

const isTextFile = (path: string) =>
  /\.(?:cjs|csv|cts|d\.ts|js|json|jsx|md|mjs|mts|ts|tsx|txt|yaml|yml)$/.test(path) ||
  path.endsWith("LICENSE") ||
  path.endsWith("README.md")

const scanTextFiles = async (
  label: string,
  files: ReadonlyArray<string>,
  failures: Array<string>
) => {
  for (const file of files) {
    if (!isTextFile(file)) {
      continue
    }
    const text = await Bun.file(file).text()
    if (privatePathPatterns.some((pattern) => pattern.test(text))) {
      failures.push(`${label}: ${file.replace(rootPath, "")} contains a private absolute path`)
    }
    if (secretLikePatterns.some((pattern) => pattern.test(text))) {
      failures.push(`${label}: ${file.replace(rootPath, "")} contains a secret-like value`)
    }
  }
}

const rootManifest = await readJsonRecord(join(rootPath, "package.json"))
const releaseVersion = stringField(rootManifest, "version")
const failures: Array<string> = []

if (releaseVersion === undefined) {
  failures.push("root package.json is missing version")
}

for (const packageDirectory of await packageDirectories()) {
  const stageDirectory = join(stageRoot, packageDirectory)
  const manifestPath = join(stageDirectory, "package.json")
  if (!(await Bun.file(manifestPath).exists())) {
    failures.push(`${packageDirectory}: staged package.json is missing`)
    continue
  }

  const manifest = await readJsonRecord(manifestPath)
  const packageName = stringField(manifest, "name")
  const manifestVersion = stringField(manifest, "version")
  const label = packageName ?? packageDirectory

  if (releaseVersion !== undefined && manifestVersion !== releaseVersion) {
    failures.push(`${label}: staged version ${manifestVersion} must equal ${releaseVersion}`)
  }

  for (const group of dependencyGroups) {
    const dependencies = manifest[group]
    if (!isRecord(dependencies)) {
      continue
    }
    for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
      if (typeof dependencyVersion !== "string") {
        failures.push(`${label}: ${group}.${dependencyName} must be a string`)
        continue
      }
      if (dependencyName.startsWith("@bp/")) {
        failures.push(`${label}: ${group}.${dependencyName} is downstream-private`)
      }
      if (isUnsafeSpec(dependencyVersion)) {
        failures.push(`${label}: ${group}.${dependencyName} has unsafe spec`)
      }
      if (
        releaseVersion !== undefined &&
        dependencyName.startsWith("@nyc-transit-kit/") &&
        dependencyVersion !== releaseVersion
      ) {
        failures.push(`${label}: ${group}.${dependencyName} must equal ${releaseVersion}`)
      }
    }
  }

  if (packageDirectory === "cli") {
    const bin = isRecord(manifest.bin) ? manifest.bin : {}
    if (bin.ntk !== "./bin/ntk" || bin["nyc-transit"] !== "./bin/nyc-transit") {
      failures.push("cli: staged bin entries must point at ./bin wrappers")
    }
    for (const wrapper of ["bin/ntk", "bin/nyc-transit"]) {
      const source = await Bun.file(join(stageDirectory, wrapper)).text()
      if (!source.startsWith("#!/usr/bin/env bun\n")) {
        failures.push(`cli: ${wrapper} must use a Bun shebang`)
      }
    }
  }

  const stagedFiles = await walkFiles(stageDirectory)
  await scanTextFiles(label, stagedFiles, failures)

  if (packageName !== undefined && releaseVersion !== undefined) {
    const tarballPath = join(artifactsRoot, packageTarballName(packageName, releaseVersion))
    if (!(await Bun.file(tarballPath).exists())) {
      failures.push(`${label}: expected artifact ${tarballPath.replace(rootPath, "")}`)
    }
  }

  const dryRun = await runCommand(["npm", "pack", "--dry-run", "--json", stageDirectory])
  if (dryRun.exitCode !== 0) {
    failures.push(`${label}: npm pack dry-run failed: ${dryRun.stderr.trim()}`)
  }
  if (dryRun.stdout.trim().length === 0) {
    failures.push(`${label}: npm pack dry-run did not produce JSON output`)
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exit(1)
}

console.log("NPM release stage preflight passed.")
