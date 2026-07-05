import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schedule from "effect/Schedule"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { defaultMtaClientConfig, MtaClientConfig } from "../client"
import type { MtaError } from "../errors"
import { MtaHttpError, MtaRetryExhaustedError, MtaTimeoutError } from "../errors"

export const httpStatusText = (status: number) => `HTTP ${status}`

export const mtaRetryableStatus = (status: number) =>
  status === 0 || status === 429 || status >= 500

export const isRetryableMtaError = (error: MtaError): error is MtaHttpError =>
  error._tag === "MtaHttpError" && mtaRetryableStatus(error.status)

export const retryableStatusError = (operation: string, status: number) =>
  mtaRetryableStatus(status)
    ? MtaHttpError.make({
        operation,
        status,
        statusText: httpStatusText(status)
      })
    : undefined

const retryPolicy = (retryTimes: number, retryDelayMs: number | undefined) =>
  retryDelayMs === undefined || retryDelayMs <= 0
    ? {
        times: retryTimes,
        while: isRetryableMtaError
      }
    : {
        schedule: Schedule.exponential(Duration.millis(retryDelayMs)).pipe(
          Schedule.both(Schedule.recurs(retryTimes))
        ),
        while: isRetryableMtaError
      }

const mtaClientConfig = Effect.serviceOption(MtaClientConfig).pipe(
  Effect.map(Option.getOrElse(() => defaultMtaClientConfig))
)

export const requestWithPolicy = <A>(
  operation: string,
  effect: Effect.Effect<A, MtaError, HttpClient.HttpClient>,
  options: {
    readonly retryableResult?: (value: A) => MtaHttpError | undefined
  } = {}
) =>
  Effect.gen(function* () {
    const config = yield* mtaClientConfig
    const retryTimes = config.retryTimes ?? 0
    const effectWithRetryableResults =
      retryTimes > 0 && options.retryableResult !== undefined
        ? effect.pipe(
            Effect.flatMap((value) => {
              const retryableError = options.retryableResult?.(value)
              return retryableError === undefined
                ? Effect.succeed(value)
                : Effect.fail(retryableError)
            })
          )
        : effect
    const retried =
      retryTimes > 0
        ? effectWithRetryableResults.pipe(
            Effect.retry(retryPolicy(retryTimes, config.retryDelayMs)),
            Effect.catchIf(isRetryableMtaError, (error) =>
              Effect.fail(
                MtaRetryExhaustedError.make({
                  operation,
                  attempts: retryTimes + 1,
                  message: `Retry attempts exhausted after provider status ${error.status}`
                })
              )
            )
          )
        : effectWithRetryableResults

    const timeoutMs = config.timeoutMs
    const timed =
      timeoutMs === undefined
        ? retried
        : retried.pipe(
            Effect.timeoutOrElse({
              duration: timeoutMs,
              orElse: () =>
                Effect.fail(
                  MtaTimeoutError.make({
                    operation,
                    timeoutMs
                  })
                )
            })
          )

    return yield* timed
  })

export const mapMtaHttpClientError = (
  operation: string,
  error: HttpClientError.HttpClientError
) => {
  const response = error.response

  if (response !== undefined) {
    return MtaHttpError.make({
      operation,
      status: response.status,
      statusText: httpStatusText(response.status)
    })
  }

  return MtaHttpError.make({
    operation,
    status: 0,
    statusText: error.message
  })
}

export const executeMtaRequest = (
  operation: string,
  request: HttpClientRequest.HttpClientRequest
): Effect.Effect<HttpClientResponse.HttpClientResponse, MtaHttpError, HttpClient.HttpClient> =>
  HttpClient.execute(request).pipe(
    Effect.mapError((error) => mapMtaHttpClientError(operation, error))
  )
