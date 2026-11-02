/**
 * What `ntk --json` writes to stdout: exactly one envelope per run, `--help`
 * included. Decode it with `Envelope`.
 */
import * as Schema from "effect/Schema"

/** Changes whenever the envelope or an error code changes; the package version moves on its own. */
export const schemaVersion = "0.2.0"

export const ApiFamily = Schema.Literals(["socrata", "mta", "nyc-open-data", "nyc-dot", "cli"])
export type ApiFamily = typeof ApiFamily.Type

export const Meta = Schema.Struct({
  apiFamily: ApiFamily,
  generatedAt: Schema.DateTimeUtcFromString,
  schemaVersion: Schema.Literal(schemaVersion)
})
export type Meta = typeof Meta.Type

export const ErrorDetail = Schema.Struct({
  code: Schema.String,
  message: Schema.String
})
export type ErrorDetail = typeof ErrorDetail.Type

export const Envelope = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), data: Schema.Unknown, meta: Meta }),
  Schema.Struct({ ok: Schema.Literal(false), error: ErrorDetail, meta: Meta })
])
export type Envelope = typeof Envelope.Type
