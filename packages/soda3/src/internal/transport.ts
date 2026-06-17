import * as Effect from "effect/Effect"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type { Soda3ClientError } from "../errors"
import {
  isRetryableProviderError,
  ProviderHttpError,
  RetryExhaustedError,
  TimeoutError
} from "../errors"
import { mapHttpClientError, retryableStatus } from "./http"
import { Soda3ClientConfig, type Soda3ClientConfigShape } from "./services"

export const addHeaders = (config: Soda3ClientConfigShape) => ({
  accept: "application/json",
  ...(config.appToken !== undefined && config.appToken.length > 0
    ? { "X-App-Token": config.appToken }
    : {})
})

export { retryableStatus }

export const requestWithPolicy = <A>(
  operation: string,
  effect: Effect.Effect<A, Soda3ClientError, HttpClient.HttpClient | Soda3ClientConfig>
) =>
  Effect.gen(function* () {
    const config = yield* Soda3ClientConfig
    const retryTimes = config.retryTimes ?? 0
    const retried =
      retryTimes > 0
        ? effect.pipe(
            Effect.retry({
              times: retryTimes,
              while: isRetryableProviderError
            }),
            Effect.catchIf(isRetryableProviderError, (error) =>
              Effect.fail(
                RetryExhaustedError.make({
                  operation,
                  attempts: retryTimes + 1,
                  message: `Retry attempts exhausted after provider status ${error.status}`
                })
              )
            )
          )
        : effect

    const timeoutMs = config.timeoutMs
    const timed =
      timeoutMs === undefined
        ? retried
        : retried.pipe(
            Effect.timeoutOrElse({
              duration: timeoutMs,
              orElse: () =>
                Effect.fail(
                  TimeoutError.make({
                    operation,
                    timeoutMs
                  })
                )
            })
          )

    return yield* timed
  })

const httpStatusText = (status: number) => `HTTP ${status}`

export const executeRequest = (operation: string, request: HttpClientRequest.HttpClientRequest) =>
  Effect.gen(function* () {
    const response = yield* HttpClient.execute(request).pipe(
      Effect.mapError((error) => mapHttpClientError(operation, error))
    )

    if (response.status < 200 || response.status >= 300) {
      return yield* ProviderHttpError.make({
        operation,
        status: response.status,
        statusText: httpStatusText(response.status),
        retryable: retryableStatus(response.status)
      })
    }

    return response
  })
