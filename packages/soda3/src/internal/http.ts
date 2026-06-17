import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { ProviderHttpError } from "../errors"

export const Soda3HttpLive = FetchHttpClient.layer

export const retryableStatus = (status: number) => status === 429 || status >= 500

const httpStatusText = (status: number) => `HTTP ${status}`

export const toWebResponse = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.map(
    Stream.toReadableStreamEffect(response.stream),
    (body) =>
      new Response(body, {
        status: response.status,
        headers: response.headers
      })
  )

export const mapHttpClientError = (operation: string, error: HttpClientError.HttpClientError) => {
  const response = error.response

  if (response !== undefined) {
    return ProviderHttpError.make({
      operation,
      status: response.status,
      statusText: httpStatusText(response.status),
      retryable: retryableStatus(response.status)
    })
  }

  return ProviderHttpError.make({
    operation,
    status: 0,
    statusText: error.message,
    retryable: true
  })
}
