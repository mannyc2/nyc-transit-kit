import {
  MtaGtfsStaticFetchRequest,
  type MtaGtfsStaticFetchRequestInput,
  MtaGtfsStaticProbeResult
} from "@nyc-transit-kit/contracts/mta"
import {
  contentLengthOf,
  httpStatusText,
  isOkStatus,
  toWebResponse
} from "@nyc-transit-kit/soda3/transport"
import * as Effect from "effect/Effect"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { MtaHttpError } from "./errors"
import {
  decodeMtaInput,
  executeMtaRequest,
  requestWithPolicy,
  retryableStatusError
} from "./internal/decode"

export { MtaHttpLive, mtaFetchLayer } from "./client"
export type { MtaGtfsStaticFetchRequestInput }

const decodeStaticFetchRequest = decodeMtaInput("gtfs-static", MtaGtfsStaticFetchRequest)
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
  const contentLength = contentLengthOf(response.headers)
  return MtaGtfsStaticProbeResult.make({
    url: request.url,
    ok: isOkStatus(response.status),
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
  if (!isOkStatus(response.status)) {
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
