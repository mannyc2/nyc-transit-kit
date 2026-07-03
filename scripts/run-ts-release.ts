#!/usr/bin/env bun

import { mkdir, stat } from "node:fs/promises"
import { dirname, isAbsolute, join } from "node:path"
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import { renderEvidenceJson } from "@mannyc1/ts-release/planner/evidence-recorder"
import { Config, Diagnostics, Live } from "@mannyc1/ts-release/workflows"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"

type JsonRecord = Record<string, unknown>
type CommandName =
  | "check-auth"
  | "check-ci"
  | "doctor"
  | "execute"
  | "explain"
  | "plan"
  | "print"
  | "reconcile"
  | "render"
  | "stage-artifacts"
  | "run"
  | "validate"
  | "validate-config"
  | "verify"

const rootPath = new URL("../", import.meta.url).pathname
const args = Bun.argv.slice(2)

const usage = `Usage: bun run scripts/run-ts-release.ts <command> [options]

Commands:
  plan              Render the release plan
  print             Render the text release plan
  validate-config   Validate release.config.json shape
  stage-artifacts   Stage ts-release artifact recipes and print staged artifacts
  explain           Explain a release operation, e.g. explain npm:npm-publish
  doctor            Run release diagnostics
  check-auth        Check release auth diagnostics
  check-ci          Check release CI diagnostics
  render            Run render operations and write render evidence
  validate          Run validation operations and write validation evidence
  execute           Run execution operations and write execution evidence
  verify            Run verification operations and write verification evidence
  run               Run render, validate, execute, and verify as one workflow
  reconcile         Reconcile mutable remote state

Options:
  --config <path>              Release config path, default release.config.json
  --format <format>            plan: json|text|summary|markdown; diagnostics: json|text|markdown
  --out <path>                 Write rendered plan to a file
  --operation <id>             Operation id for explain
  --target <id>                Target id for check-auth
  --workflow <path>            Workflow path for check-ci, default .github/workflows/release.yml
  --execute                    Allow non-dry-run operations
  --approve-irreversible       Approve irreversible operations`

const die = (message: string): never => {
  console.error(message)
  console.error(usage)
  process.exit(1)
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readJsonRecord = async (pathName: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(pathName).text())
  if (!isRecord(parsed)) {
    throw new Error(`${pathName} did not contain a JSON object`)
  }
  return parsed
}

const writeJson = async (pathName: string, value: JsonRecord) => {
  await mkdir(dirname(pathName), { recursive: true })
  await Bun.write(pathName, `${JSON.stringify(value, null, 2)}\n`)
}

const workspacePath = (pathName: string) =>
  isAbsolute(pathName) ? pathName : join(rootPath, pathName)

const hasGitMetadata = async () => {
  try {
    const metadata = await stat(join(rootPath, ".git"))
    return metadata.isDirectory() || metadata.isFile()
  } catch {
    return false
  }
}

const commandFromInput = (value: string | undefined): CommandName => {
  switch (value) {
    case "check-auth":
    case "check-ci":
    case "doctor":
    case "execute":
    case "explain":
    case "plan":
    case "print":
    case "reconcile":
    case "render":
    case "stage-artifacts":
    case "run":
    case "validate":
    case "validate-config":
    case "verify":
      return value
    default:
      return die(`Unknown or missing ts-release command: ${value ?? "<missing>"}`)
  }
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

const optionalFlagValue = (name: string) => {
  const value = flagValue(name, "")
  return value.length === 0 ? undefined : value
}

const positionalValue = (index: number) => {
  const values = args.slice(1).filter((value) => !value.startsWith("--"))
  return values[index]
}

const hasFlag = (name: string) => args.includes(name)

const parsePlanFormat = (value: string): Config.ReleasePlanFormat => {
  switch (value) {
    case "json":
    case "markdown":
    case "summary":
    case "text":
      return value
    default:
      return die(`Unsupported plan format: ${value}`)
  }
}

const parseValidationFormat = (value: string): Config.ReleaseConfigValidationFormat => {
  switch (value) {
    case "json":
    case "text":
      return value
    default:
      return die(`Unsupported validation format: ${value}`)
  }
}

const parseStageArtifactsFormat = (value: string): Config.StageArtifactsFormat => {
  switch (value) {
    case "json":
    case "text":
      return value
    default:
      return die(`Unsupported stage-artifacts format: ${value}`)
  }
}

const parseDiagnosticsFormat = (value: string): Diagnostics.ReleaseDiagnosticsFormat => {
  switch (value) {
    case "json":
    case "markdown":
    case "text":
      return value
    default:
      return die(`Unsupported diagnostics format: ${value}`)
  }
}

const configPathForCommand = async (command: CommandName, configPath: string) => {
  if ((command !== "plan" && command !== "print") || (await hasGitMetadata())) {
    return configPath
  }

  const config = await readJsonRecord(workspacePath(configPath))
  if (!isRecord(config.identity) || config.identity.commit !== "HEAD") {
    return configPath
  }

  config.identity = {
    ...config.identity,
    commit: "unknown"
  }

  const localConfigPath = ".release/generated/release.local.config.json"
  await writeJson(workspacePath(localConfigPath), config)
  return localConfigPath
}

const writeFile = Effect.fn("run-ts-release.writeFile")(function* (
  pathName: string,
  contents: string
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* fs.makeDirectory(path.dirname(pathName), { recursive: true })
  yield* fs.writeFileString(pathName, contents)
})

const writeOrPrint = Effect.fn("run-ts-release.writeOrPrint")(function* (
  out: string,
  contents: string
) {
  if (out.length > 0) {
    return yield* writeFile(out, contents)
  }
  return yield* Console.log(contents.trimEnd())
})

const printWrittenEvidence = Effect.fn("run-ts-release.printWrittenEvidence")(function* (
  result: Config.PlannedReleaseConfigWrittenEvidenceResult
) {
  yield* Console.log(renderEvidenceJson(result.evidence).trimEnd())
})

const renderDiagnostics = Effect.fn("run-ts-release.renderDiagnostics")(function* (
  report: Diagnostics.ReleaseDiagnosticReport,
  format: Diagnostics.ReleaseDiagnosticsFormat
) {
  yield* Console.log(Diagnostics.render(report, format).trimEnd())
})

const programForCommand = (command: CommandName, configPath: string) => {
  const input = { root: rootPath, configPath }

  switch (command) {
    case "plan":
      return Config.renderPlan({
        ...input,
        format: parsePlanFormat(flagValue("--format", "text"))
      }).pipe(Effect.flatMap((contents) => writeOrPrint(flagValue("--out", ""), contents)))

    case "print":
      return Config.renderPlan({
        ...input,
        format: "text"
      }).pipe(Effect.flatMap((contents) => Console.log(contents.trimEnd())))

    case "validate-config":
      return Config.renderValidation({
        ...input,
        format: parseValidationFormat(flagValue("--format", "text"))
      }).pipe(Effect.flatMap((contents) => Console.log(contents.trimEnd())))

    case "stage-artifacts":
      return Config.renderStageArtifacts({
        ...input,
        format: parseStageArtifactsFormat(flagValue("--format", "text"))
      }).pipe(Effect.flatMap((contents) => Console.log(contents.trimEnd())))

    case "explain": {
      const operationId = flagValue("--operation", positionalValue(0) ?? "")
      if (operationId.length === 0) {
        return die("Missing operation id for explain")
      }
      return Config.explain({ ...input, operationId }).pipe(
        Effect.flatMap((contents) => Console.log(contents.trimEnd()))
      )
    }

    case "doctor": {
      const format = parseDiagnosticsFormat(flagValue("--format", "text"))
      return Diagnostics.doctor({ ...input, format }).pipe(
        Effect.flatMap((report) => renderDiagnostics(report, format))
      )
    }

    case "check-auth": {
      const format = parseDiagnosticsFormat(flagValue("--format", "text"))
      return Diagnostics.checkAuth({
        ...input,
        format,
        target: optionalFlagValue("--target")
      }).pipe(Effect.flatMap((report) => renderDiagnostics(report, format)))
    }

    case "check-ci": {
      const format = parseDiagnosticsFormat(flagValue("--format", "text"))
      return Diagnostics.checkCi({
        ...input,
        format,
        provider: "github-actions",
        workflow: flagValue("--workflow", ".github/workflows/release.yml")
      }).pipe(Effect.flatMap((report) => renderDiagnostics(report, format)))
    }

    case "render":
      return Config.planAndWriteRender({
        ...input,
        execute: hasFlag("--execute")
      }).pipe(Effect.flatMap(printWrittenEvidence))

    case "validate":
      return Config.planAndWriteValidation(input).pipe(Effect.flatMap(printWrittenEvidence))

    case "execute":
      return Config.planAndWriteExecution({
        ...input,
        approveIrreversible: hasFlag("--approve-irreversible"),
        execute: hasFlag("--execute")
      }).pipe(Effect.flatMap(printWrittenEvidence))

    case "verify":
      return Config.planAndWriteVerification(input).pipe(Effect.flatMap(printWrittenEvidence))

    case "run":
      return Config.planAndWriteRun({
        ...input,
        approveIrreversible: hasFlag("--approve-irreversible"),
        execute: hasFlag("--execute")
      }).pipe(Effect.flatMap(printWrittenEvidence))

    case "reconcile":
      return Config.planAndWriteReconcile({
        ...input,
        execute: hasFlag("--execute")
      }).pipe(Effect.flatMap(printWrittenEvidence))
  }
}

const command = commandFromInput(args[0])
const configPath = await configPathForCommand(command, flagValue("--config", "release.config.json"))
const runtimeLayer = Live.makeLayer({ root: rootPath }).pipe(
  Layer.provideMerge(BunServices.layer),
  Layer.provideMerge(BunHttpClient.layer)
)

programForCommand(command, configPath).pipe(Effect.provide(runtimeLayer), BunRuntime.runMain)
