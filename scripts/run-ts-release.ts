#!/usr/bin/env bun

import { mkdir, stat } from "node:fs/promises"
import { dirname, isAbsolute, join } from "node:path"
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import type {
  EvidenceBundle,
  ReleaseWorkflowEvidence,
  ReleaseWorkflowFailureEvidence
} from "@mannyc1/ts-release/domain/evidence"
import type { ReleasePlan } from "@mannyc1/ts-release/domain/release"
import { renderEvidenceJson } from "@mannyc1/ts-release/planner/evidence-recorder"
import * as ConfigWorkflow from "@mannyc1/ts-release/workflows/config"
import * as EvidenceWorkflow from "@mannyc1/ts-release/workflows/evidence"
import * as LiveWorkflow from "@mannyc1/ts-release/workflows/live"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"

type JsonRecord = Record<string, unknown>
type CommandName =
  | "execute"
  | "plan"
  | "print"
  | "reconcile"
  | "render"
  | "resume"
  | "run"
  | "status"
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
  status            Render release operation status
  render            Run render operations and write render evidence
  validate          Run validation operations and write validation evidence
  execute           Run execution operations and write execution evidence
  verify            Run verification operations and write verification evidence
  run               Run render, validate, execute, and verify as one workflow
  resume            Resume a release workflow from existing evidence
  reconcile         Reconcile mutable remote state

Options:
  --config <path>              Release config path, default release.config.json
  --format <format>            plan: json|text|summary|markdown; status: json|text
  --out <path>                 Write rendered plan to a file
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
    case "execute":
    case "plan":
    case "print":
    case "reconcile":
    case "render":
    case "resume":
    case "run":
    case "status":
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

const hasFlag = (name: string) => args.includes(name)

const parsePlanFormat = (value: string): ConfigWorkflow.ReleasePlanFormat => {
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

const parseValidationFormat = (value: string): ConfigWorkflow.ReleaseConfigValidationFormat => {
  switch (value) {
    case "json":
    case "text":
      return value
    default:
      return die(`Unsupported validation format: ${value}`)
  }
}

const parseStatusFormat = (value: string): "json" | "text" => {
  switch (value) {
    case "json":
    case "text":
      return value
    default:
      return die(`Unsupported status format: ${value}`)
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

const writeAndPrintEvidence = Effect.fn("run-ts-release.writeAndPrintEvidence")(function* (
  plan: ReleasePlan,
  name: string,
  evidence: EvidenceBundle
) {
  yield* EvidenceWorkflow.writeNamedEvidence(plan, name, evidence)
  yield* Console.log(renderEvidenceJson(evidence).trimEnd())
})

const writeFailedEvidence = Effect.fn("run-ts-release.writeFailedEvidence")(function* (
  plan: ReleasePlan,
  name: string,
  error: { readonly evidence?: EvidenceBundle | undefined }
) {
  const path = yield* EvidenceWorkflow.writeFailedOperationEvidence(plan, name, error)
  if (path !== undefined && error.evidence !== undefined) {
    yield* Console.log(renderEvidenceJson(error.evidence).trimEnd())
  }
})

const writeWorkflowEvidence = Effect.fn("run-ts-release.writeWorkflowEvidence")(function* (
  plan: ReleasePlan,
  evidence: ReleaseWorkflowEvidence | ReleaseWorkflowFailureEvidence
) {
  const paths = yield* EvidenceWorkflow.writeWorkflowEvidence(plan, evidence)
  yield* Console.log(JSON.stringify({ evidence: paths }, null, 2))
})

const programForCommand = (command: CommandName, configPath: string) => {
  const input = { root: rootPath, configPath }

  switch (command) {
    case "plan":
      return Effect.gen(function* () {
        const contents = yield* ConfigWorkflow.renderPlan({
          ...input,
          format: parsePlanFormat(flagValue("--format", "text"))
        })
        yield* writeOrPrint(flagValue("--out", ""), contents)
      })

    case "print":
      return Effect.gen(function* () {
        const contents = yield* ConfigWorkflow.renderPlan({
          ...input,
          format: "text"
        })
        yield* Console.log(contents.trimEnd())
      })

    case "validate-config":
      return Effect.gen(function* () {
        const contents = yield* ConfigWorkflow.renderValidation({
          ...input,
          format: parseValidationFormat(flagValue("--format", "text"))
        })
        yield* Console.log(contents.trimEnd())
      })

    case "status":
      return Effect.gen(function* () {
        const contents = yield* ConfigWorkflow.renderStatus({
          ...input,
          format: parseStatusFormat(flagValue("--format", "text"))
        })
        yield* Console.log(contents.trimEnd())
      })

    case "render":
      return Effect.gen(function* () {
        const options = { ...input, execute: hasFlag("--execute") }
        const plan = yield* ConfigWorkflow.plan(options)
        const evidence = yield* ConfigWorkflow.render(options).pipe(
          Effect.catchTag("OperationFailedError", (error) =>
            writeFailedEvidence(plan, "render", error).pipe(
              Effect.flatMap(() => Effect.fail(error))
            )
          )
        )
        yield* writeAndPrintEvidence(plan, "render", evidence)
      })

    case "validate":
      return Effect.gen(function* () {
        const plan = yield* ConfigWorkflow.plan(input)
        const evidence = yield* ConfigWorkflow.validate(input).pipe(
          Effect.catchTag("OperationFailedError", (error) =>
            writeFailedEvidence(plan, "validation", error).pipe(
              Effect.flatMap(() => Effect.fail(error))
            )
          )
        )
        yield* writeAndPrintEvidence(plan, "validation", evidence)
      })

    case "execute":
      return Effect.gen(function* () {
        const options = {
          ...input,
          approveIrreversible: hasFlag("--approve-irreversible"),
          execute: hasFlag("--execute")
        }
        const plan = yield* ConfigWorkflow.plan(options)
        const evidence = yield* ConfigWorkflow.execute(options).pipe(
          Effect.catchTag("OperationFailedError", (error) =>
            writeFailedEvidence(plan, "execution", error).pipe(
              Effect.flatMap(() => Effect.fail(error))
            )
          )
        )
        yield* writeAndPrintEvidence(plan, "execution", evidence)
      })

    case "verify":
      return Effect.gen(function* () {
        const plan = yield* ConfigWorkflow.plan(input)
        const evidence = yield* ConfigWorkflow.verify(input).pipe(
          Effect.catchTag("OperationFailedError", (error) =>
            writeFailedEvidence(plan, "verification", error).pipe(
              Effect.flatMap(() => Effect.fail(error))
            )
          )
        )
        yield* writeAndPrintEvidence(plan, "verification", evidence)
      })

    case "run":
      return Effect.gen(function* () {
        const options = {
          ...input,
          approveIrreversible: hasFlag("--approve-irreversible"),
          execute: hasFlag("--execute")
        }
        const plan = yield* ConfigWorkflow.plan(options)
        const evidence = yield* ConfigWorkflow.run(options).pipe(
          Effect.catchTag("OperationFailedError", (error) => {
            if (error.workflowEvidence === undefined) {
              return Effect.fail(error)
            }
            return writeWorkflowEvidence(plan, error.workflowEvidence).pipe(
              Effect.flatMap(() => Effect.fail(error))
            )
          })
        )
        yield* writeWorkflowEvidence(plan, evidence)
      })

    case "resume":
      return Effect.gen(function* () {
        const options = {
          ...input,
          approveIrreversible: hasFlag("--approve-irreversible"),
          execute: hasFlag("--execute")
        }
        const plan = yield* ConfigWorkflow.plan(options)
        const evidence = yield* ConfigWorkflow.resume(options).pipe(
          Effect.catchTag("OperationFailedError", (error) => {
            if (error.workflowEvidence === undefined) {
              return Effect.fail(error)
            }
            return writeWorkflowEvidence(plan, error.workflowEvidence).pipe(
              Effect.flatMap(() => Effect.fail(error))
            )
          })
        )
        yield* writeWorkflowEvidence(plan, evidence)
      })

    case "reconcile":
      return Effect.gen(function* () {
        const options = { ...input, execute: hasFlag("--execute") }
        const plan = yield* ConfigWorkflow.plan(options)
        const evidence = yield* ConfigWorkflow.reconcile(options).pipe(
          Effect.catchTag("OperationFailedError", (error) =>
            writeFailedEvidence(plan, "reconciliation", error).pipe(
              Effect.flatMap(() => Effect.fail(error))
            )
          )
        )
        yield* writeAndPrintEvidence(plan, "reconciliation", evidence)
      })
  }
}

const command = commandFromInput(args[0])
const configPath = await configPathForCommand(command, flagValue("--config", "release.config.json"))
const runtimeLayer = LiveWorkflow.makeLayer({ root: rootPath }).pipe(
  Layer.provideMerge(BunServices.layer),
  Layer.provideMerge(BunHttpClient.layer)
)

programForCommand(command, configPath).pipe(Effect.provide(runtimeLayer), BunRuntime.runMain)
