/**
 * Where command results go: one envelope with `--json`, readable text without
 * it. Also the closed table of error codes.
 */
import type { GtfsRealtimeDecodeError } from "@nyc-transit-kit/mta/GtfsRealtime"
import type { DatasetNotFound } from "@nyc-transit-kit/soda3/Discovery"
import type { SocrataError } from "@nyc-transit-kit/soda3/Socrata"
import type { SoqlError } from "@nyc-transit-kit/soda3/Soql"
import * as Console from "effect/Console"
import * as Context from "effect/Context"
import type * as CliError from "effect/cli/CliError"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import type * as HttpClientError from "effect/http/HttpClientError"
import * as Layer from "effect/Layer"
import type * as PlatformError from "effect/PlatformError"
import * as Runtime from "effect/Runtime"
import * as Schema from "effect/Schema"
import * as Stdio from "effect/Stdio"
import * as Stream from "effect/Stream"
import { type ApiFamily, Envelope, type ErrorDetail, schemaVersion } from "./Envelope"

export class Output extends Context.Service<
  Output,
  {
    readonly success: (apiFamily: ApiFamily, data: unknown) => Effect.Effect<void>
    readonly failure: (apiFamily: ApiFamily, error: ErrorDetail) => Effect.Effect<void>
  }
>()("@nyc-transit-kit/cli/Output") {}

const encodeEnvelope = Schema.encodeEffect(Schema.fromJsonString(Envelope))

type Outcome =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: ErrorDetail }

// Straight to stdout, not Console: in JSON mode Console is silenced so help text cannot leak in.
// An envelope that fails to encode, or a closed stdout, cannot be reported anywhere, so it dies.
const writeEnvelope = (stdio: Stdio.Stdio, apiFamily: ApiFamily, outcome: Outcome) =>
  DateTime.now.pipe(
    Effect.flatMap((generatedAt) =>
      encodeEnvelope({ ...outcome, meta: { apiFamily, generatedAt, schemaVersion } })
    ),
    Effect.flatMap((line) =>
      Stream.run(Stream.make(`${line}\n`), stdio.stdout({ endOnDone: false }))
    ),
    Effect.orDie
  )

export const layerJson = Layer.effect(
  Output,
  Effect.map(Stdio.Stdio, (stdio) =>
    Output.of({
      success: (apiFamily, data) => writeEnvelope(stdio, apiFamily, { ok: true, data }),
      failure: (apiFamily, error) => writeEnvelope(stdio, apiFamily, { ok: false, error })
    })
  )
)

export const layerHuman = Layer.succeed(
  Output,
  Output.of({
    success: (_, data) =>
      Console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2)),
    failure: (_, error) => Console.error(`ntk: ${error.message} (${error.code})`)
  })
)

export const success = (apiFamily: ApiFamily, data: unknown) =>
  Output.use((output) => output.success(apiFamily, data))

export const failure = (apiFamily: ApiFamily, error: ErrorDetail) =>
  Output.use((output) => output.failure(apiFamily, error))

/** The run already printed its failure; exit 1 without the runtime logging it again. */
export class Reported extends Schema.TaggedError<Reported>()("Reported", {}) {
  override readonly [Runtime.errorReported] = false
}

export type CommandError =
  | CliError.CliError
  | HttpClientError.HttpClientError
  | SocrataError
  | SoqlError
  | DatasetNotFound
  | Schema.SchemaError
  | GtfsRealtimeDecodeError
  | PlatformError.PlatformError

const httpCodes = {
  TransportError: "network-error",
  EncodeError: "request-encode-error",
  InvalidUrlError: "invalid-url",
  StatusCodeError: "http-status",
  DecodeError: "response-decode-error",
  EmptyBodyError: "empty-response"
} satisfies Record<HttpClientError.HttpClientErrorReason["_tag"], string>

const cliCodes = {
  UnrecognizedOption: "unknown-option",
  DuplicateOption: "duplicate-option",
  MissingOption: "missing-option",
  MissingArgument: "missing-argument",
  UnexpectedArgument: "unexpected-argument",
  InvalidValue: "invalid-option",
  UnknownSubcommand: "unknown-command",
  ValidationError: "invalid-option",
  ShowHelp: "missing-command",
  UserError: "command-failed"
} satisfies Record<CliError.CliError["_tag"], string>

// Flags that fall back to an environment variable; a missing-flag error names both.
const environmentFallbacks: Readonly<Record<string, string>> = { "app-token": "SOCRATA_APP_TOKEN" }

/** Stable error codes for the JSON contract. A new error type does not compile until it has one. */
export const errorDetail = (error: CommandError): ErrorDetail => {
  switch (error._tag) {
    case "HttpClientError":
      return { code: httpCodes[error.reason._tag], message: error.message }
    case "SocrataError":
      return { code: "socrata-error", message: error.message }
    // The CLI sends SoQL as text, which cannot fail to compile; a fragment built from flags would be a bad flag.
    case "SoqlError":
      return { code: "invalid-option", message: error.message }
    case "DatasetNotFound":
      return { code: "dataset-not-found", message: error.message }
    case "SchemaError":
      return { code: "unexpected-response", message: error.message }
    case "GtfsRealtimeDecodeError":
      return { code: "not-gtfs-realtime", message: error.message }
    case "PlatformError":
      return { code: "file-error", message: error.message }
    case "MissingOption": {
      const variable = environmentFallbacks[error.option]
      return {
        code: cliCodes.MissingOption,
        message: variable === undefined ? error.message : `${error.message}, or set ${variable}`
      }
    }
    case "ShowHelp":
      return error.errors[0] === undefined
        ? {
            code: cliCodes.ShowHelp,
            message: `Choose a subcommand of ${error.commandPath.join(" ")}`
          }
        : errorDetail(error.errors[0])
    default:
      return { code: cliCodes[error._tag], message: error.message }
  }
}
