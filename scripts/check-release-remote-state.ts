#!/usr/bin/env bun

import { spawnSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

type JsonRecord = Record<string, unknown>
type ReleaseStatus = "complete" | "partial" | "ready"
type NpmPackageStatus = "missing" | "published"

type NpmTarget = {
  readonly packageName: string
  readonly registry: string
}

type GitHubTarget = {
  readonly repository: string
}

type ReleaseConfig = {
  readonly tag: string
  readonly version: string
  readonly npmTargets: ReadonlyArray<NpmTarget>
  readonly githubTarget: GitHubTarget
}

export type NpmReleasePackageState = {
  readonly packageName: string
  readonly state: NpmPackageStatus
}

export type GitHubReleaseState = "draft" | "missing" | "published"

export type RemoteReleaseState = {
  readonly githubState: GitHubReleaseState
  readonly npmStates: ReadonlyArray<NpmReleasePackageState>
  readonly tag: string
}

export type ReleaseEligibility = {
  readonly githubState: GitHubReleaseState
  readonly npmSummary: string
  readonly reason: string
  readonly shouldRelease: boolean
  readonly status: ReleaseStatus
}

const rootPath = new URL("../", import.meta.url).pathname
const usage = `Usage: bun run scripts/check-release-remote-state.ts [options]

Options:
  --config <path>             Release config path, default release.config.json
  --require-complete          Exit successfully only when npm and GitHub are complete
  --settle-attempts <count>   Total attempts for partial states, default 1
  --settle-delay-ms <ms>      Delay between settle attempts, default 5000`

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

const workspacePath = (pathName: string) =>
  isAbsolute(pathName) ? pathName : join(rootPath, pathName)

const die = (message: string): never => {
  console.error(message)
  console.error(usage)
  process.exit(1)
}

const flagValue = (args: ReadonlyArray<string>, name: string, fallback: string) => {
  const index = args.indexOf(name)
  if (index < 0) {
    return fallback
  }
  const value = args[index + 1]
  if (value === undefined || value.startsWith("--")) {
    return die(`Missing value for ${name}`)
  }
  return value
}

const numberFlagValue = (args: ReadonlyArray<string>, name: string, fallback: number) => {
  const value = flagValue(args, name, String(fallback))
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return die(`${name} must be a positive integer`)
  }
  return parsed
}

const hasFlag = (args: ReadonlyArray<string>, name: string) => args.includes(name)

const commandOutput = (result: ReturnType<typeof spawnSync>) => {
  const stdout = typeof result.stdout === "string" ? result.stdout : ""
  const stderr = typeof result.stderr === "string" ? result.stderr : ""
  return `${stdout}\n${stderr}`
}

const isMissingOutput = (text: string) => {
  const normalized = text.toLowerCase()
  return (
    normalized.includes("404") ||
    normalized.includes("e404") ||
    normalized.includes("not found") ||
    normalized.includes("not in this registry") ||
    normalized.includes("release not found")
  )
}

const runCommand = (command: string, args: ReadonlyArray<string>) =>
  spawnSync(command, [...args], {
    cwd: rootPath,
    encoding: "utf8"
  })

const readReleaseConfig = async (pathName: string): Promise<ReleaseConfig> => {
  const parsed: unknown = JSON.parse(await readFile(workspacePath(pathName), "utf8"))
  if (!isRecord(parsed)) {
    throw new Error(`${pathName} did not contain a JSON object`)
  }

  const identity = isRecord(parsed.identity) ? parsed.identity : undefined
  const version = identity === undefined ? undefined : stringField(identity, "version")
  const tag = identity === undefined ? undefined : (stringField(identity, "tag") ?? `v${version}`)
  const targets = Array.isArray(parsed.targets) ? parsed.targets : []

  if (version === undefined || tag === undefined) {
    throw new Error(`${pathName} is missing release identity version/tag`)
  }

  const npmTargets: Array<NpmTarget> = []
  let githubTarget: GitHubTarget | undefined

  for (const target of targets) {
    if (!isRecord(target)) {
      continue
    }
    if (target._tag === "NpmRegistryTarget") {
      const packageName = stringField(target, "packageName")
      const registry = stringField(target, "registry")
      if (packageName === undefined || registry === undefined) {
        throw new Error("release.config.json contains an incomplete npm target")
      }
      npmTargets.push({ packageName, registry })
      continue
    }
    if (target._tag === "GitHubReleaseTarget") {
      const repository = stringField(target, "repository")
      if (repository === undefined) {
        throw new Error("release.config.json contains an incomplete GitHub target")
      }
      githubTarget = { repository }
    }
  }

  if (npmTargets.length === 0) {
    throw new Error("release.config.json is missing npm release targets")
  }
  if (githubTarget === undefined) {
    throw new Error("release.config.json is missing a GitHub release target")
  }

  return {
    githubTarget,
    npmTargets,
    tag,
    version
  }
}

const queryNpmPackage = (version: string, target: NpmTarget): NpmReleasePackageState => {
  const result = runCommand("npm", [
    "view",
    `${target.packageName}@${version}`,
    "version",
    "--registry",
    target.registry
  ])

  if (result.status === 0) {
    return {
      packageName: target.packageName,
      state: "published"
    }
  }

  const output = commandOutput(result)
  if (isMissingOutput(output)) {
    return {
      packageName: target.packageName,
      state: "missing"
    }
  }

  throw new Error(`npm view failed for ${target.packageName}@${version}: ${output.trim()}`)
}

const queryGitHubRelease = (tag: string, target: GitHubTarget): GitHubReleaseState => {
  const byTag = runCommand("gh", ["api", `repos/${target.repository}/releases/tags/${tag}`])
  if (byTag.status === 0) {
    const parsed: unknown = JSON.parse(String(byTag.stdout))
    return isRecord(parsed) && booleanField(parsed, "draft") === true ? "draft" : "published"
  }

  const byTagOutput = commandOutput(byTag)
  if (!isMissingOutput(byTagOutput)) {
    throw new Error(`gh api failed for ${tag}: ${byTagOutput.trim()}`)
  }

  const view = runCommand("gh", [
    "release",
    "view",
    tag,
    "--repo",
    target.repository,
    "--json",
    "isDraft,tagName"
  ])
  if (view.status === 0) {
    const parsed: unknown = JSON.parse(String(view.stdout))
    return isRecord(parsed) && booleanField(parsed, "isDraft") === true ? "draft" : "published"
  }

  const viewOutput = commandOutput(view)
  if (isMissingOutput(viewOutput)) {
    return "missing"
  }

  throw new Error(`gh release view failed for ${tag}: ${viewOutput.trim()}`)
}

const queryRemoteReleaseState = async (configPath: string): Promise<RemoteReleaseState> => {
  const config = await readReleaseConfig(configPath)
  return {
    githubState: queryGitHubRelease(config.tag, config.githubTarget),
    npmStates: config.npmTargets.map((target) => queryNpmPackage(config.version, target)),
    tag: config.tag
  }
}

const npmSummary = (states: ReadonlyArray<NpmReleasePackageState>) =>
  states.map((entry) => `${entry.packageName}:${entry.state}`).join(", ")

export const classifyReleaseState = (state: RemoteReleaseState): ReleaseEligibility => {
  const allNpmPublished = state.npmStates.every((entry) => entry.state === "published")
  const allNpmMissing = state.npmStates.every((entry) => entry.state === "missing")
  const summary = npmSummary(state.npmStates)

  if (allNpmMissing && state.githubState === "missing") {
    return {
      githubState: state.githubState,
      npmSummary: summary,
      reason: `${state.tag} is missing from npm and GitHub.`,
      shouldRelease: true,
      status: "ready"
    }
  }

  if (allNpmPublished && state.githubState === "published") {
    return {
      githubState: state.githubState,
      npmSummary: summary,
      reason: `${state.tag} already exists remotely.`,
      shouldRelease: false,
      status: "complete"
    }
  }

  return {
    githubState: state.githubState,
    npmSummary: summary,
    reason: `partial release state for ${state.tag}: npm=[${summary}] github=${state.githubState}`,
    shouldRelease: false,
    status: "partial"
  }
}

const writeOutputs = (eligibility: ReleaseEligibility) => {
  const outputPath = process.env.GITHUB_OUTPUT
  if (outputPath === undefined || outputPath.length === 0) {
    return
  }

  appendFileSync(outputPath, `should_release=${eligibility.shouldRelease ? "true" : "false"}\n`)
  appendFileSync(outputPath, `status=${eligibility.status}\n`)
  appendFileSync(outputPath, `reason=${eligibility.reason}\n`)
  appendFileSync(outputPath, `github_state=${eligibility.githubState}\n`)
  appendFileSync(outputPath, `npm_summary=${eligibility.npmSummary}\n`)
}

const shouldRetry = (
  eligibility: ReleaseEligibility,
  requireComplete: boolean,
  attempt: number,
  attempts: number
) => {
  if (attempt >= attempts) {
    return false
  }
  return requireComplete ? eligibility.status !== "complete" : eligibility.status === "partial"
}

const main = async () => {
  const args = Bun.argv.slice(2)
  if (hasFlag(args, "--help")) {
    console.log(usage)
    return
  }

  const configPath = flagValue(args, "--config", "release.config.json")
  const requireComplete = hasFlag(args, "--require-complete")
  const attempts = numberFlagValue(args, "--settle-attempts", 1)
  const delayMs = numberFlagValue(args, "--settle-delay-ms", 5000)

  let latest: ReleaseEligibility | undefined

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = classifyReleaseState(await queryRemoteReleaseState(configPath))
    console.log(
      `release eligibility: ${latest.status}; should_release=${
        latest.shouldRelease ? "true" : "false"
      }; ${latest.reason}`
    )

    if (!shouldRetry(latest, requireComplete, attempt, attempts)) {
      break
    }

    console.log(`waiting ${delayMs}ms for remote release state to settle`)
    await sleep(delayMs)
  }

  if (latest === undefined) {
    throw new Error("remote release state was not checked")
  }

  writeOutputs(latest)

  if (requireComplete && latest.status !== "complete") {
    throw new Error(`release did not complete remotely: ${latest.reason}`)
  }
  if (!requireComplete && latest.status === "partial") {
    throw new Error(latest.reason)
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
