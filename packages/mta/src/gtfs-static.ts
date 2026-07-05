import {
  MtaGtfsStaticFetchRequest,
  type MtaGtfsStaticFetchRequestInput,
  MtaGtfsStaticProbeResult
} from "@nyc-transit-kit/contracts/mta"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { MtaHttpError, MtaInvalidInputError } from "./errors"
import {
  executeMtaRequest,
  httpStatusText,
  requestWithPolicy,
  retryableStatusError
} from "./internal/policy"

export { MtaHttpLive, mtaFetchLayer } from "./client"
export type { MtaGtfsStaticFetchRequestInput }

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
  if (value === undefined) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

export const probeGtfsStatic = Effect.fn("Mta.probeGtfsStatic")(function* (
  input: MtaGtfsStaticFetchRequestInput
) {
  const request = yield* decodeStaticFetchRequest(input)
  const response = yield* requestWithPolicy(
    "gtfs-static",
    executeMtaRequest("gtfs-static", HttpClientRequest.head(request.url)),
    {
      retryableResult: (response) => retryableStatusError("gtfs-static", response.status)
    }
  )
  const contentType = response.headers["content-type"]
  const contentLength = responseContentLength(response)

  return MtaGtfsStaticProbeResult.make({
    url: request.url,
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    ...(contentType === undefined ? {} : { contentType }),
    ...(contentLength === undefined ? {} : { contentLength })
  })
})

export const fetchGtfsStaticResponse = Effect.fn("Mta.fetchGtfsStaticResponse")(function* (
  input: MtaGtfsStaticFetchRequestInput
) {
  const request = yield* decodeStaticFetchRequest(input)
  const response = yield* requestWithPolicy(
    "gtfs-static",
    executeMtaRequest("gtfs-static", HttpClientRequest.get(request.url)),
    {
      retryableResult: (response) => retryableStatusError("gtfs-static", response.status)
    }
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
