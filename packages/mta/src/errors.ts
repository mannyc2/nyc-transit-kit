import * as Schema from "effect/Schema"

export class MtaHttpError extends Schema.TaggedErrorClass<MtaHttpError>()("MtaHttpError", {
  operation: Schema.String,
  status: Schema.Number,
  statusText: Schema.String
}) {}

export class MtaDecodeError extends Schema.TaggedErrorClass<MtaDecodeError>()("MtaDecodeError", {
  feed: Schema.String,
  message: Schema.String
}) {}

export class MtaInvalidInputError extends Schema.TaggedErrorClass<MtaInvalidInputError>()(
  "MtaInvalidInputError",
  {
    operation: Schema.String,
    message: Schema.String
  }
) {}

export type MtaError = MtaHttpError | MtaDecodeError | MtaInvalidInputError

export const isMtaError = (value: unknown): value is MtaError =>
  value instanceof MtaHttpError ||
  value instanceof MtaDecodeError ||
  value instanceof MtaInvalidInputError
