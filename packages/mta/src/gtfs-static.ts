import {
  MtaGtfsStaticFetchRequest,
  type MtaGtfsStaticFetchRequestInput,
  MtaGtfsStaticProbeResult
} from "@nyc-transit-kit/contracts/mta"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { MtaHttpError, MtaInvalidInputError } from "./errors"

export type { MtaGtfsStaticFetchRequestInput }

export const MtaHttpLive = FetchHttpClient.layer

const decodeStaticFetchRequest = (input: unknown) =>
  Schema.decodeUnknownEffect(MtaGtfsStaticFetchRequest)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        MtaInvalidInputError.make({
          operation: "gtfs-static",
          message: error.message
        })
      )
    )
  )

const httpStatusText = (status: number) => `HTTP ${status}`

const mapMtaHttpClientError = (operation: string, error: HttpClientError.HttpClientError) => {
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

const toWebResponse = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.map(
    Stream.toReadableStreamEffect(response.stream),
    (body) =>
      new Response(body, {
        status: response.status,
        headers: response.headers
      })
  )

const responseContentLength = (response: HttpClientResponse.HttpClientResponse) => {
  const value = response.headers["content-length"]
  return value === undefined ? undefined : Number(value)
}

export const probeGtfsStatic = Effect.fn("Mta.probeGtfsStatic")(function* (
  input: MtaGtfsStaticFetchRequestInput
) {
  const request = yield* decodeStaticFetchRequest(input)
  const response = yield* HttpClient.execute(HttpClientRequest.head(request.url)).pipe(
    Effect.mapError((error) => mapMtaHttpClientError("gtfs-static", error))
  )

  return MtaGtfsStaticProbeResult.make({
    url: request.url,
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    contentType: response.headers["content-type"],
    contentLength: responseContentLength(response)
  })
})

export const fetchGtfsStaticResponse = Effect.fn("Mta.fetchGtfsStaticResponse")(function* (
  input: MtaGtfsStaticFetchRequestInput
) {
  const request = yield* decodeStaticFetchRequest(input)
  const response = yield* HttpClient.execute(HttpClientRequest.get(request.url)).pipe(
    Effect.mapError((error) => mapMtaHttpClientError("gtfs-static", error))
  )

  if (response.status < 200 || response.status >= 300) {
    return yield* MtaHttpError.make({
      operation: "gtfs-static",
      status: response.status,
      statusText: httpStatusText(response.status)
    })
  }

  return yield* toWebResponse(response)
})

export const fetchGtfsStatic = Effect.fn("Mta.fetchGtfsStatic")(function* (
  input: MtaGtfsStaticFetchRequestInput
) {
  const response = yield* fetchGtfsStaticResponse(input)

  return yield* Effect.tryPromise({
    try: () => response.arrayBuffer(),
    catch: () =>
      MtaHttpError.make({
        operation: "gtfs-static",
        status: response.status,
        statusText: "Failed to read response body"
      })
  })
})
