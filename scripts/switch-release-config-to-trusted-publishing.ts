#!/usr/bin/env bun

import { join } from "node:path"

type JsonRecord = Record<string, unknown>

const rootPath = new URL("../", import.meta.url).pathname
const args = Bun.argv.slice(2)
const expectedPackages: ReadonlyArray<readonly [string, string]> = [
  ["npm-cli", "@nyc-transit-kit/cli"],
  ["npm-compat", "@nyc-transit-kit/compat"],
  ["npm-contracts", "@nyc-transit-kit/contracts"],
  ["npm-fixtures", "@nyc-transit-kit/fixtures"],
  ["npm-mta", "@nyc-transit-kit/mta"],
  ["npm-nyc-dot", "@nyc-transit-kit/nyc-dot"],
  ["npm-nyc-open-data", "@nyc-transit-kit/nyc-open-data"],
  ["npm-soda3", "@nyc-transit-kit/soda3"]
]

const usage = `Usage: bun run scripts/switch-release-config-to-trusted-publishing.ts [options]

Options:
  --config <path>      Release config path, default release.config.json
  --workflow <file>    GitHub Actions workflow filename, default release.yml`

const die = (message: string): never => {
  console.error(message)
  console.error(usage)
  process.exit(1)
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringField = (record: JsonRecord, key: string) => {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

const flagValue = (name: string, fallback: string) => {
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

const expectedPackageName = (targetId: string) => {
  for (const [id, packageName] of expectedPackages) {
    if (id === targetId) {
      return packageName
    }
  }
  return undefined
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
  const stderr = await streamText(proc.stderr)
  const exitCode = await proc.exited
  return { exitCode, stdout, stderr }
}

const assertWorkflowFilename = (workflow: string) => {
  if (
    workflow.length === 0 ||
    workflow.includes("/") ||
    workflow.includes("\\") ||
    (!workflow.endsWith(".yml") && !workflow.endsWith(".yaml"))
  ) {
    return die("Trusted publishing workflow must be a .yml or .yaml filename")
  }
}

const missingPackages: Array<string> = []
for (const [, packageName] of expectedPackages) {
  const result = await runCommand(["npm", "view", packageName, "version", "--json"])
  if (result.exitCode !== 0) {
    missingPackages.push(packageName)
  }
}

if (missingPackages.length > 0) {
  console.error(
    [
      "Cannot switch release.config.json to trusted publishing yet.",
      "These packages were not visible on npm:",
      ...missingPackages.map((packageName) => `- ${packageName}`),
      "",
      "Run the token-backed bootstrap publish first, then rerun this command."
    ].join("\n")
  )
  process.exit(1)
}

const workflow = flagValue("--workflow", "release.yml")
assertWorkflowFilename(workflow)

const configPath = flagValue("--config", "release.config.json")
const configFile = join(rootPath, configPath)
const config = await readJsonRecord(configFile)
const targets = Array.isArray(config.targets)
  ? config.targets
  : die("release targets must be an array")
const seenTargets = new Set<string>()

let updatedCount = 0
const updatedTargets = targets.map((target) => {
  if (!isRecord(target)) {
    return die("release targets must be objects")
  }
  if (stringField(target, "_tag") !== "NpmRegistryTarget") {
    return target
  }

  const id = stringField(target, "id")
  if (id === undefined) {
    return die("npm target is missing id")
  }
  const packageName = expectedPackageName(id)
  if (packageName === undefined) {
    return die(`unknown npm release target: ${id}`)
  }

  seenTargets.add(id)
  updatedCount += 1

  const updated: JsonRecord = {
    ...target,
    packageName,
    trustedPublishing: {
      provider: "github-actions",
      workflow,
      packageExists: true,
      verifyPackageExists: true
    },
    provenance: true
  }
  delete updated.tokenEnv
  delete updated.usernameEnv
  delete updated.passwordEnv
  return updated
})

for (const [id] of expectedPackages) {
  if (!seenTargets.has(id)) {
    die(`release config is missing npm target ${id}`)
  }
}

config.targets = updatedTargets
await Bun.write(configFile, `${JSON.stringify(config, null, 2)}\n`)
console.log(`Switched ${updatedCount} npm release targets to trusted publishing via ${workflow}.`)
