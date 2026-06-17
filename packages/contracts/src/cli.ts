import * as Schema from "effect/Schema"

const cliSchemaVersion = "0.1.0"

export const CliMetaApiFamily = Schema.Literals([
  "socrata",
  "mta",
  "nyc-open-data",
  "nyc-dot",
  "cli"
])
export type CliMetaApiFamily = typeof CliMetaApiFamily.Type

export class CliEnvelopeMeta extends Schema.Class<CliEnvelopeMeta>("CliEnvelopeMeta")({
  apiFamily: CliMetaApiFamily,
  generatedAt: Schema.String,
  schemaVersion: Schema.Literal(cliSchemaVersion)
}) {}

export class CliErrorDetail extends Schema.Class<CliErrorDetail>("CliErrorDetail")({
  code: Schema.String,
  message: Schema.String,
  provider: Schema.optionalKey(Schema.String),
  retryable: Schema.optionalKey(Schema.Boolean),
  command: Schema.optionalKey(Schema.String)
}) {}

export class CliErrorEnvelope extends Schema.Class<CliErrorEnvelope>("CliErrorEnvelope")({
  ok: Schema.Literal(false),
  error: CliErrorDetail,
  meta: CliEnvelopeMeta
}) {}

export class CliSuccessEnvelope extends Schema.Class<CliSuccessEnvelope>("CliSuccessEnvelope")({
  ok: Schema.Literal(true),
  data: Schema.Unknown,
  meta: CliEnvelopeMeta
}) {}

export const CliEnvelope = Schema.Union([CliSuccessEnvelope, CliErrorEnvelope])
export type CliEnvelope = typeof CliEnvelope.Type
