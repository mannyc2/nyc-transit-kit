import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import type * as Headers from "effect/unstable/http/Headers"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

export type FetchImplementation = (
  input: string | URL | globalThis.Request,
  init?: globalThis.RequestInit
) => Promise<globalThis.Response>

export interface RequestPolicyConfig {
  readonly retryTimes?: number
  readonly retryDelayMs?: number
  readonly timeoutMs?: number
}

export const httpStatusText = (status: number) => `HTTP ${status}`
export const retryableStatus = (status: number) => status === 429 || status >= 500
export const isOkStatus = (status: number) => status >= 200 && status < 300

const retryPolicy = <E>(
  retryTimes: number,
  retryDelayMs: number | undefined,
  isRetryable: (error: E) => boolean
) =>
  retryDelayMs === undefined || retryDelayMs <= 0
    ? {
        times: retryTimes,
        while: isRetryable
      }
    : {
        schedule: Schedule.exponential(Duration.millis(retryDelayMs)).pipe(
          Schedule.both(Schedule.recurs(retryTimes))
        ),
        while: isRetryable
      }

export const withRequestPolicy = <A, E, R, Retryable extends E>(
  config: RequestPolicyConfig,
  effect: Effect.Effect<A, E, R>,
  adapters: {
    readonly isRetryable: (error: E) => error is Retryable
    readonly onExhausted: (attempts: number, error: Retryable) => E
    readonly onTimeout: (timeoutMs: number) => E
    readonly retryableResult?: (value: A) => E | undefined
  }
): Effect.Effect<A, E, R> => {
  const retryTimes = config.retryTimes ?? 0
  const effectWithRetryableResults =
    retryTimes > 0 && adapters.retryableResult !== undefined
      ? effect.pipe(
          Effect.flatMap((value) => {
            const retryableError = adapters.retryableResult?.(value)
            return retryableError === undefined
              ? Effect.succeed(value)
              : Effect.fail(retryableError)
          })
        )
      : effect
  const retried =
    retryTimes > 0
      ? effectWithRetryableResults.pipe(
          Effect.retry(retryPolicy(retryTimes, config.retryDelayMs, adapters.isRetryable)),
          Effect.catchIf(adapters.isRetryable, (error) =>
            Effect.fail(adapters.onExhausted(retryTimes + 1, error))
          )
        )
      : effectWithRetryableResults
  const timeoutMs = config.timeoutMs

  return timeoutMs === undefined
    ? retried
    : retried.pipe(
        Effect.timeoutOrElse({
          duration: timeoutMs,
          orElse: () => Effect.fail(adapters.onTimeout(timeoutMs))
        })
      )
}

export const httpFailureInfo = (error: HttpClientError.HttpClientError) => {
  const response = error.response

  return response === undefined
    ? {
        status: 0,
        statusText: error.message
      }
    : {
        status: response.status,
        statusText: httpStatusText(response.status)
      }
}

export const toWebResponse = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.map(
    Stream.toReadableStreamEffect(response.stream),
    (body) =>
      new Response(body, {
        status: response.status,
        headers: response.headers
      })
  )

export const contentLengthOf = (headers: Headers.Headers) => {
  const value = headers["content-length"]
  if (value === undefined) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

const shouldRedactSearchParameter = (name: string) => {
  const lower = name.toLowerCase()
  return lower.includes("key") || lower.includes("token") || lower.includes("secret")
}

export const redactedUrl = (url: string) => {
  try {
    const parsed = new URL(url)

    for (const name of parsed.searchParams.keys()) {
      if (shouldRedactSearchParameter(name)) {
        parsed.searchParams.set(name, "REDACTED")
      }
    }

    return parsed.toString()
  } catch {
    return "[invalid-url]"
  }
}

export const fetchHttpClientLayer = (fetchImplementation?: FetchImplementation) =>
  fetchImplementation === undefined
    ? FetchHttpClient.layer
    : FetchHttpClient.layer.pipe(
        Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetchImplementation as typeof fetch))
      )
