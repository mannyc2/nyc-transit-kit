import * as Transport from "@nyc-transit-kit/soda3/transport"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import { defaultMtaClientConfig, MtaClientConfig } from "../client"
import {
  type MtaError,
  MtaHttpError,
  MtaInvalidInputError,
  MtaRetryExhaustedError,
  MtaTimeoutError
} from "../errors"

export const decodeMtaInput =
  <S extends Schema.Top>(operation: string, schema: S) =>
  (input: unknown) =>
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.catchTag("SchemaError", (error) =>
        Effect.fail(MtaInvalidInputError.make({ operation, message: error.message }))
      )
    )

const isRetryableStatus = (status: number) => status === 0 || Transport.retryableStatus(status)
const isRetryableMtaError = (error: MtaError): error is MtaHttpError =>
  error._tag === "MtaHttpError" && isRetryableStatus(error.status)
export const retryableStatusError = (operation: string, status: number) =>
  isRetryableStatus(status)
    ? MtaHttpError.make({ operation, status, statusText: Transport.httpStatusText(status) })
    : undefined
const exhaustedMessage = (status: number) =>
  `Retry attempts exhausted after provider status ${status}`
const exhausted = (operation: string, attempts: number, error: MtaHttpError) =>
  MtaRetryExhaustedError.make({ operation, attempts, message: exhaustedMessage(error.status) })
export const requestWithPolicy = <A, R>(
  operation: string,
  effect: Effect.Effect<A, MtaError, R>,
  options: { readonly retryableResult?: (value: A) => MtaHttpError | undefined } = {}
) =>
  Effect.gen(function* () {
    const config = yield* Effect.serviceOption(MtaClientConfig).pipe(
      Effect.map(Option.getOrElse(() => defaultMtaClientConfig))
    )
    return yield* Transport.withRequestPolicy(config, effect, {
      isRetryable: isRetryableMtaError,
      onExhausted: (attempts, error) => exhausted(operation, attempts, error),
      onTimeout: (timeoutMs) => MtaTimeoutError.make({ operation, timeoutMs }),
      ...(options.retryableResult === undefined ? {} : { retryableResult: options.retryableResult })
    })
  })
export const executeMtaRequest = (
  operation: string,
  request: Parameters<typeof HttpClient.execute>[0]
) =>
  HttpClient.execute(request).pipe(
    Effect.mapError((error) => {
      const info = Transport.httpFailureInfo(error)
      return MtaHttpError.make({ operation, status: info.status, statusText: info.statusText })
    })
  )
