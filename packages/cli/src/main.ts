import * as BunServices from "@effect/platform-bun/BunServices"
import { schemaVersion } from "@nyc-transit-kit/contracts/metadata"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as CliError from "effect/unstable/cli/CliError"
import * as Command from "effect/unstable/cli/Command"
import { rootCommand } from "./commands/root"
import {
  apiFamilyFor,
  CliCommandContext,
  commandLabel,
  errorEnvelope,
  packageBuildCommit,
  packageBuildTarget,
  packageVersion,
  successEnvelope,
  writeJson
} from "./commands/shared"
import { localBinaryName } from "./index"
import { makeCliRuntime } from "./runtime"

type CommandRunResult =
  | {
      readonly _tag: "Failure"
      readonly error: unknown
    }
  | {
      readonly _tag: "Success"
    }

type JsonErrorDetails = {
  readonly code: string
  readonly message: string
  readonly tokens: ReadonlyArray<string>
}

const noop = () => undefined

const consoleMethodNames =
  "assert clear count countReset debug dir dirxml error group groupCollapsed groupEnd info log table time timeEnd timeLog trace warn".split(
    " "
  ) as ReadonlyArray<keyof Console.Console>

const quietConsole = Object.fromEntries(
  consoleMethodNames.map((name) => [name, noop])
) as unknown as Console.Console

const stripRootCommand = (path: ReadonlyArray<string>) =>
  path[0] === localBinaryName ? path.slice(1) : path

const messageOf = (error: CliError.CliError) =>
  "message" in error && typeof error.message === "string" ? error.message : "Command failed."

const jsonErrorDetails = (
  error: CliError.CliError,
  fallbackPath: ReadonlyArray<string> = []
): JsonErrorDetails => {
  switch (error._tag) {
    case "ShowHelp": {
      const firstError = error.errors[0]
      if (firstError !== undefined) {
        return jsonErrorDetails(firstError, error.commandPath)
      }

      return {
        code: "command-failed",
        message: "Command failed.",
        tokens: stripRootCommand(error.commandPath)
      }
    }
    case "MissingOption":
      return {
        code: "missing-option",
        message: error.message,
        tokens: stripRootCommand(fallbackPath)
      }
    case "MissingArgument":
      return {
        code: "missing-argument",
        message: error.message,
        tokens: stripRootCommand(fallbackPath)
      }
    case "UnknownSubcommand": {
      const parent = error.parent ?? fallbackPath
      return {
        code: "unknown-command",
        message: error.message,
        tokens: stripRootCommand([...parent, error.subcommand])
      }
    }
    case "UnrecognizedOption":
      return {
        code: "unknown-option",
        message: error.message,
        tokens: stripRootCommand(error.command ?? fallbackPath)
      }
    case "InvalidValue":
      return {
        code: "invalid-option",
        message: error.message,
        tokens: stripRootCommand(fallbackPath)
      }
    case "DuplicateOption":
    case "UserError":
      return {
        code: "command-failed",
        message: messageOf(error),
        tokens: stripRootCommand(fallbackPath)
      }
  }
}

const writeJsonFailure = (error: unknown) => {
  const details = CliError.isCliError(error)
    ? jsonErrorDetails(error)
    : {
        code: "command-failed",
        message: "Command failed.",
        tokens: []
      }

  process.exitCode = 1
  writeJson(
    errorEnvelope(apiFamilyFor(details.tokens), {
      code: details.code,
      message: details.message,
      command: commandLabel(details.tokens)
    })
  )
}

const versionJson = () =>
  successEnvelope("cli", {
    binary: localBinaryName,
    version: packageVersion,
    schemaVersion,
    commit: packageBuildCommit,
    buildTarget: packageBuildTarget
  })

export const main = async () => {
  const args = Bun.argv.slice(2)
  if (args.includes("--version")) {
    if (args.includes("--json")) {
      writeJson(versionJson())
      return
    }

    console.log(`${localBinaryName} ${packageVersion}`)
    return
  }

  const context = {
    runtime: makeCliRuntime(process.env),
    writeJson
  }
  const baseProgram = Command.runWith(rootCommand, { version: packageVersion })(args).pipe(
    Effect.provideService(CliCommandContext, context),
    Effect.provide(BunServices.layer)
  )
  const shouldKeepJsonClean = args.includes("--json") && !args.includes("--help")
  const program = shouldKeepJsonClean
    ? baseProgram.pipe(Effect.provideService(Console.Console, quietConsole))
    : baseProgram

  const result = await Effect.runPromise(
    program.pipe(
      Effect.match({
        onFailure: (error): CommandRunResult => ({
          _tag: "Failure",
          error
        }),
        onSuccess: (): CommandRunResult => ({
          _tag: "Success"
        })
      })
    )
  )

  if (result._tag === "Success") {
    return
  }

  if (args.includes("--json")) {
    writeJsonFailure(result.error)
    return
  }

  process.exitCode = 1
}

if (import.meta.main) {
  await main()
}
