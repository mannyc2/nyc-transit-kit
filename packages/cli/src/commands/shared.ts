import * as Effect from "effect/Effect"
import { errorEnvelope, successEnvelope } from "../output"
import type { ApiFamily, CommandContext, CommandResult } from "./types"

export const writeJson = (output: unknown) => {
  console.log(JSON.stringify(output))
}

export const commandLabel = (tokens: ReadonlyArray<string>) =>
  tokens.length > 0 ? tokens.join(" ") : "(missing command)"

export const apiFamilyFor = (tokens: ReadonlyArray<string>): ApiFamily => {
  switch (tokens[0]) {
    case "socrata":
    case "catalog":
      return "socrata"
    case "mta":
      return "mta"
    case "nyc-open-data":
      return "nyc-open-data"
    case "nyc-dot":
      return "nyc-dot"
    default:
      return "cli"
  }
}

export const failCommand = (
  context: CommandContext,
  apiFamily: ApiFamily,
  code: string,
  message: string,
  tokens: ReadonlyArray<string>,
  options?: {
    readonly provider?: string
    readonly retryable?: boolean
  }
) =>
  Effect.sync(() => {
    process.exitCode = 1
    context.writeJson(
      errorEnvelope(apiFamily, {
        code,
        message,
        provider: options?.provider,
        retryable: options?.retryable,
        command: commandLabel(tokens)
      })
    )
  })

export const writeSuccess = (context: CommandContext, apiFamily: ApiFamily, data: unknown) =>
  Effect.sync(() => {
    context.writeJson(successEnvelope(apiFamily, data))
  })

const writeFailure = (
  context: CommandContext,
  apiFamily: ApiFamily,
  code: string,
  message: string,
  tokens: ReadonlyArray<string>
) =>
  Effect.sync(() => {
    process.exitCode = 1
    context.writeJson(
      errorEnvelope(apiFamily, {
        code,
        message,
        command: commandLabel(tokens)
      })
    )
  })

export const missingOption = (
  context: CommandContext,
  tokens: ReadonlyArray<string>,
  option: string
) =>
  failCommand(
    context,
    apiFamilyFor(tokens),
    "missing-option",
    `Missing required option --${option}.`,
    tokens
  )

export const soqlFromSelect = (select: string) =>
  select.trim().toUpperCase().startsWith("SELECT ") ? select : `SELECT ${select}`

const taggedMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message
    if (typeof message === "string") {
      return message
    }
  }

  return "Command failed."
}

const taggedCode = (error: unknown) => {
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tag = error._tag
    if (typeof tag === "string") {
      return tag
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/_/g, "-")
        .toLowerCase()
    }
  }

  return "command-failed"
}

export const runEffect = <A>(
  context: CommandContext,
  apiFamily: ApiFamily,
  tokens: ReadonlyArray<string>,
  effect: Effect.Effect<A, unknown>
) =>
  effect.pipe(
    Effect.match({
      onFailure: (error): CommandResult<A> => ({
        _tag: "Failure",
        error
      }),
      onSuccess: (data): CommandResult<A> => ({
        _tag: "Success",
        data
      })
    }),
    Effect.flatMap((result) =>
      result._tag === "Success"
        ? writeSuccess(context, apiFamily, result.data)
        : writeFailure(
            context,
            apiFamily,
            taggedCode(result.error),
            taggedMessage(result.error),
            tokens
          )
    )
  )
