import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import {
  type CoverageProvider,
  isRecord,
  parseCoverageProvider,
  requiredArgValue
} from "./provider-descriptor-shared"

type CliConfig = {
  readonly manifestPath: string
  readonly outPath: string
}

type ManifestEntry = {
  readonly provider: CoverageProvider
  readonly input: string
}

type ProviderCoverageResult = {
  readonly provider: CoverageProvider
  readonly expectedCount: number
  readonly localCount: number
  readonly missingIds: ReadonlyArray<string>
  readonly extraIds: ReadonlyArray<string>
  readonly ok: boolean
}

const defaultOutPath = ".release/evidence/provider-coverage.json"

const parseArgs = (args: ReadonlyArray<string>): CliConfig => {
  let manifestPath: string | undefined
  let outPath = defaultOutPath

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === undefined) {
      continue
    }

    switch (arg) {
      case "--manifest":
        manifestPath = requiredArgValue(args, index, arg)
        index += 1
        break
      case "--out":
        outPath = requiredArgValue(args, index, arg)
        index += 1
        break
      default:
        throw new Error(`Unsupported argument ${arg}`)
    }
  }

  if (manifestPath === undefined) {
    throw new Error("Missing --manifest")
  }

  return {
    manifestPath,
    outPath
  }
}

const stringField = (record: Record<string, unknown>, field: string) => {
  const value = record[field]
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected string field ${field}`)
  }
  return value
}

const numberField = (record: Record<string, unknown>, field: string) => {
  const value = record[field]
  if (typeof value !== "number") {
    throw new Error(`Expected number field ${field}`)
  }
  return value
}

const booleanField = (record: Record<string, unknown>, field: string) => {
  const value = record[field]
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean field ${field}`)
  }
  return value
}

const stringArrayField = (record: Record<string, unknown>, field: string) => {
  const value = record[field]
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Expected string array field ${field}`)
  }
  return value
}

const parseManifest = (input: unknown): ReadonlyArray<ManifestEntry> => {
  if (!isRecord(input)) {
    throw new Error("Manifest JSON must be an object")
  }

  const providers = input.providers
  if (!Array.isArray(providers)) {
    throw new Error("Manifest JSON must include providers array")
  }

  return providers.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Manifest provider entry ${index} must be an object`)
    }

    return {
      provider: parseCoverageProvider(stringField(entry, "provider")),
      input: stringField(entry, "input")
    }
  })
}

const parseProviderResult = (input: unknown): ProviderCoverageResult => {
  if (!isRecord(input)) {
    throw new Error("Coverage checker output must be a JSON object")
  }

  return {
    provider: parseCoverageProvider(stringField(input, "provider")),
    expectedCount: numberField(input, "expectedCount"),
    localCount: numberField(input, "localCount"),
    missingIds: stringArrayField(input, "missingIds"),
    extraIds: stringArrayField(input, "extraIds"),
    ok: booleanField(input, "ok")
  }
}

const runProviderCoverageCheck = async (entry: ManifestEntry): Promise<ProviderCoverageResult> => {
  const proc = Bun.spawn(
    [
      "bun",
      "run",
      "scripts/check-provider-coverage.ts",
      "--provider",
      entry.provider,
      "--input",
      entry.input
    ],
    {
      cwd: process.cwd(),
      stderr: "pipe",
      stdout: "pipe"
    }
  )
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  if (stdout.trim().length === 0) {
    throw new Error(
      [`Provider coverage check failed for ${entry.provider}`, stderr.trim()]
        .filter((line) => line.length > 0)
        .join(": ")
    )
  }

  const result = parseProviderResult(JSON.parse(stdout))
  if (result.provider !== entry.provider) {
    throw new Error(
      `Provider coverage check returned ${result.provider} for manifest provider ${entry.provider}`
    )
  }
  if (exitCode !== 0 && result.ok) {
    throw new Error(`Provider coverage check for ${entry.provider} exited ${exitCode} but ok=true`)
  }

  return result
}

const main = async () => {
  const config = parseArgs(Bun.argv.slice(2))
  const manifest: unknown = JSON.parse(await Bun.file(config.manifestPath).text())
  const entries = parseManifest(manifest)
  const providers = await Promise.all(entries.map((entry) => runProviderCoverageCheck(entry)))
  const evidence = {
    ok: providers.every((provider) => provider.ok),
    generatedAt: new Date().toISOString(),
    providers
  }

  await mkdir(dirname(config.outPath), {
    recursive: true
  })
  await Bun.write(config.outPath, JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))

  if (!evidence.ok) {
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
