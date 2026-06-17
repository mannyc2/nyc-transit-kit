import * as Schema from "effect/Schema"

export class InvalidInputError extends Schema.TaggedErrorClass<InvalidInputError>()(
  "InvalidInputError",
  {
    operation: Schema.String,
    message: Schema.String
  }
) {}

export class ProviderHttpError extends Schema.TaggedErrorClass<ProviderHttpError>()(
  "ProviderHttpError",
  {
    operation: Schema.String,
    status: Schema.Number,
    statusText: Schema.String,
    retryable: Schema.Boolean
  }
) {}

export class ProviderContractError extends Schema.TaggedErrorClass<ProviderContractError>()(
  "ProviderContractError",
  {
    operation: Schema.String,
    message: Schema.String
  }
) {}

export class TimeoutError extends Schema.TaggedErrorClass<TimeoutError>()("TimeoutError", {
  operation: Schema.String,
  timeoutMs: Schema.Number
}) {}

export class RetryExhaustedError extends Schema.TaggedErrorClass<RetryExhaustedError>()(
  "RetryExhaustedError",
  {
    operation: Schema.String,
    attempts: Schema.Number,
    message: Schema.String
  }
) {}

export type Soda3ClientError =
  | InvalidInputError
  | ProviderHttpError
  | ProviderContractError
  | TimeoutError
  | RetryExhaustedError

export const isRetryableProviderError = (error: Soda3ClientError): error is ProviderHttpError =>
  error._tag === "ProviderHttpError" && error.retryable
