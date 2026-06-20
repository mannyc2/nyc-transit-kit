import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"

type JsonRecord = Record<string, unknown>

const rootPath = new URL("../", import.meta.url).pathname
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

const booleanField = (record: JsonRecord, key: string) => {
  const value = record[key]
  return typeof value === "boolean" ? value : undefined
}

const readJsonRecord = async (path: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(parsed)) {
    throw new Error(`${path} did not contain a JSON object`)
  }
  return parsed
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
  const exitCode = await proc.exited
  return exitCode === 0 ? stdout.trim() : undefined
}

const hasGitMetadata = async () => {
  try {
    const metadata = await stat(join(rootPath, ".git"))
    return metadata.isDirectory() || metadata.isFile()
  } catch {
    return false
  }
}

const collectDuplicateValues = (values: ReadonlyArray<string>) => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }
  return [...duplicates].toSorted()
}

const isSafeRelativePath = (value: string) =>
  !value.startsWith("/") &&
  !/^[A-Za-z]:[\\/]/.test(value) &&
  !value.split(/[\\/]+/).includes("..") &&
  !privatePathPatterns.some((pattern) => pattern.test(value))

const envExampleDocuments = (contents: string, name: string) =>
  contents.split(/\r?\n/).some((line) => {
    const trimmed = line.trim()
    return trimmed === name || trimmed.startsWith(`${name}=`)
  })

const targetTokenEnvNames = (target: JsonRecord) => {
  const names: Array<string> = []
  for (const key of ["tokenEnv", "usernameEnv", "passwordEnv"]) {
    const value = stringField(target, key)
    if (value !== undefined && value.length > 0) {
      names.push(value)
    }
  }
  return names
}

const expectedNpmPackageName = (targetId: string) =>
  targetId.startsWith("npm-") ? `@nyc-transit-kit/${targetId.slice("npm-".length)}` : undefined

const failures: Array<string> = []
const rootManifest = await readJsonRecord(join(rootPath, "package.json"))
const releaseConfig = await readJsonRecord(join(rootPath, "release.config.json"))
const rootVersion = stringField(rootManifest, "version")
const envExample = await Bun.file(join(rootPath, ".env.example")).text()
const identity = isRecord(releaseConfig.identity) ? releaseConfig.identity : undefined
const artifacts = Array.isArray(releaseConfig.artifacts) ? releaseConfig.artifacts : []
const targets = Array.isArray(releaseConfig.targets) ? releaseConfig.targets : []

if (identity === undefined) {
  failures.push("release.config.json identity must be an object")
} else {
  const version = stringField(identity, "version")
  const tag = stringField(identity, "tag")
  const commit = stringField(identity, "commit")

  if (rootVersion !== undefined && version !== rootVersion) {
    failures.push(`release identity version ${version} must match root version ${rootVersion}`)
  }
  if (version !== undefined && tag !== `v${version}`) {
    failures.push(`release identity tag ${tag} must match v${version}`)
  }

  if (commit === undefined || commit.length === 0) {
    failures.push("release identity commit must be a non-empty string")
  } else if (await hasGitMetadata()) {
    const currentCommit = await runCommand(["git", "rev-parse", "--short", "HEAD"])
    const trackedStatus = await runCommand(["git", "status", "--porcelain", "--untracked-files=no"])
    if (commit === "HEAD" && currentCommit === undefined) {
      failures.push("release identity commit HEAD requires a committed Git checkout")
    }
    if (commit === "HEAD" && trackedStatus !== undefined && trackedStatus.length > 0) {
      failures.push("release identity commit HEAD requires a clean tracked working tree")
    }
    if (commit !== "HEAD" && currentCommit !== undefined && commit !== currentCommit) {
      failures.push(
        `release identity commit ${commit} must match current git commit ${currentCommit}`
      )
    }
  }
}

const artifactIds: Array<string> = []
for (const artifact of artifacts) {
  if (!isRecord(artifact)) {
    failures.push("release artifacts must be objects")
    continue
  }
  const id = stringField(artifact, "id")
  const path = stringField(artifact, "path")
  if (id === undefined) {
    failures.push("release artifact is missing id")
  } else {
    artifactIds.push(id)
  }
  if (path === undefined || !isSafeRelativePath(path)) {
    failures.push(`release artifact ${id ?? "<unknown>"} has unsafe path`)
  }
}

const targetIds: Array<string> = []
const tokenEnvNames = new Set<string>()
for (const target of targets) {
  if (!isRecord(target)) {
    failures.push("release targets must be objects")
    continue
  }
  const id = stringField(target, "id")
  const tag = stringField(target, "_tag")
  if (id === undefined) {
    failures.push("release target is missing id")
  } else {
    targetIds.push(id)
  }
  for (const name of targetTokenEnvNames(target)) {
    tokenEnvNames.add(name)
  }
  if (tag === "NpmRegistryTarget") {
    const packagePath = stringField(target, "packagePath")
    const packageName = stringField(target, "packageName")
    const tokenEnv = stringField(target, "tokenEnv")
    const trustedPublishing = isRecord(target.trustedPublishing)
      ? target.trustedPublishing
      : undefined
    if (packagePath === undefined || !packagePath.startsWith(".release/npm/")) {
      failures.push(`npm target ${id ?? "<unknown>"} must package from .release/npm/`)
    }
    if (packagePath !== undefined && !isSafeRelativePath(packagePath)) {
      failures.push(`npm target ${id ?? "<unknown>"} has unsafe packagePath`)
    }
    if (packageName === undefined) {
      failures.push(`npm target ${id ?? "<unknown>"} is missing packageName`)
    }
    if (id !== undefined && packageName !== undefined) {
      const expected = expectedNpmPackageName(id)
      if (expected !== undefined && packageName !== expected) {
        failures.push(`npm target ${id} packageName ${packageName} must be ${expected}`)
      }
    }
    if (tokenEnv !== undefined && trustedPublishing !== undefined) {
      failures.push(
        `npm target ${id ?? "<unknown>"} cannot use tokenEnv and trustedPublishing together`
      )
    }
    if (tokenEnv === undefined && trustedPublishing === undefined) {
      failures.push(`npm target ${id ?? "<unknown>"} must use tokenEnv or trustedPublishing`)
    }
    if (trustedPublishing !== undefined) {
      const provider = stringField(trustedPublishing, "provider")
      const workflow = stringField(trustedPublishing, "workflow")
      if (provider !== "github-actions") {
        failures.push(
          `npm target ${id ?? "<unknown>"} trustedPublishing provider must be github-actions`
        )
      }
      if (
        workflow === undefined ||
        workflow.includes("/") ||
        workflow.includes("\\") ||
        (!workflow.endsWith(".yml") && !workflow.endsWith(".yaml"))
      ) {
        failures.push(
          `npm target ${id ?? "<unknown>"} trustedPublishing workflow must be a workflow filename`
        )
      }
      if (booleanField(trustedPublishing, "packageExists") !== true) {
        failures.push(
          `npm target ${id ?? "<unknown>"} trustedPublishing packageExists must be true`
        )
      }
      if (booleanField(trustedPublishing, "verifyPackageExists") !== true) {
        failures.push(
          `npm target ${id ?? "<unknown>"} trustedPublishing verifyPackageExists must be true`
        )
      }
      if (booleanField(target, "provenance") !== true) {
        failures.push(
          `npm target ${id ?? "<unknown>"} must enable provenance with trustedPublishing`
        )
      }
    }
  }
  if (tag === "GitHubReleaseTarget") {
    const repository = stringField(target, "repository")
    if (
      repository === undefined ||
      repository === "owner/repo" ||
      repository.includes("/") === false ||
      privatePathPatterns.some((pattern) => pattern.test(repository))
    ) {
      failures.push("GitHub release target repository must be a real owner/repo slug")
    }
  }
}

for (const duplicate of collectDuplicateValues(artifactIds)) {
  failures.push(`duplicate release artifact id: ${duplicate}`)
}
for (const duplicate of collectDuplicateValues(targetIds)) {
  failures.push(`duplicate release target id: ${duplicate}`)
}
for (const name of [...tokenEnvNames].toSorted()) {
  if (!envExampleDocuments(envExample, name)) {
    failures.push(`.env.example must document ${name}`)
  }
}

const packageEntries = await readdir(join(rootPath, "packages"), { withFileTypes: true })
const packageNames = packageEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
for (const packageName of packageNames) {
  if (!artifactIds.includes(`npm-${packageName}`)) {
    failures.push(`release config is missing npm artifact for ${packageName}`)
  }
  if (!targetIds.includes(`npm-${packageName}`)) {
    failures.push(`release config is missing npm target for ${packageName}`)
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exit(1)
}

console.log("Release config preflight passed.")
