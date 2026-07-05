import {
  type GtfsFeedKind,
  MtaGtfsRealtimeCaptureRequest,
  type MtaGtfsRealtimeCaptureRequestInput,
  MtaGtfsRealtimeCaptureResult,
  MtaGtfsRealtimeDecodedHeader,
  MtaGtfsRealtimeDecodedSummary,
  MtaGtfsRealtimeProbeRequest,
  type MtaGtfsRealtimeProbeRequestInput,
  MtaGtfsRealtimeProbeResult
} from "@nyc-transit-kit/contracts/mta"
import { httpStatusText, isOkStatus, redactedUrl } from "@nyc-transit-kit/soda3/transport"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as GtfsRealtimeBindings from "gtfs-realtime-bindings"
import { MtaDecodeError, MtaHttpError } from "./errors"
import {
  decodeMtaInput,
  executeMtaRequest,
  requestWithPolicy,
  retryableStatusError
} from "./internal/decode"
export type GtfsRealtimeDecoderImplementation = (
  bytes: Uint8Array,
  feed?: GtfsFeedKind
) => Effect.Effect<MtaGtfsRealtimeDecodedSummary, MtaDecodeError>
export type { MtaGtfsRealtimeCaptureRequestInput, MtaGtfsRealtimeProbeRequestInput }

const FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage
const FeedHeaderIncrementality = GtfsRealtimeBindings.transit_realtime.FeedHeader.Incrementality
const hasOwn = (value: object, key: PropertyKey) => Object.hasOwn(value, key)
const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))
const byteToHex = (byte: number) => byte.toString(16).padStart(2, "0")
const arrayBufferFromBytes = (bytes: Uint8Array) => {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}
const incrementalityName = (
  value: GtfsRealtimeBindings.transit_realtime.FeedHeader.Incrementality
) => {
  if (value === FeedHeaderIncrementality.FULL_DATASET) {
    return "FULL_DATASET"
  }
  if (value === FeedHeaderIncrementality.DIFFERENTIAL) {
    return "DIFFERENTIAL"
  }
  return String(value)
}
const decodedHeader = (header: GtfsRealtimeBindings.transit_realtime.IFeedHeader) =>
  MtaGtfsRealtimeDecodedHeader.make({
    gtfsRealtimeVersion: header.gtfsRealtimeVersion,
    ...(hasOwn(header, "incrementality")
      ? {
          incrementality: incrementalityName(
            header.incrementality ?? FeedHeaderIncrementality.FULL_DATASET
          )
        }
      : {}),
    ...(hasOwn(header, "timestamp") && header.timestamp !== undefined && header.timestamp !== null
      ? { timestamp: Number(header.timestamp) }
      : {})
  })
export const decodeGtfsRealtimeBytesSync = (
  bytes: Uint8Array,
  feed?: GtfsFeedKind
): MtaGtfsRealtimeDecodedSummary => {
  try {
    const raw = FeedMessage.decode(bytes)
    const entities = raw.entity
    return MtaGtfsRealtimeDecodedSummary.make({
      ...(feed === undefined ? {} : { feed }),
      entityCount: entities.length,
      tripUpdateCount: entities.filter(
        (entity) => entity.tripUpdate !== undefined && entity.tripUpdate !== null
      ).length,
      vehiclePositionCount: entities.filter(
        (entity) => entity.vehicle !== undefined && entity.vehicle !== null
      ).length,
      alertCount: entities.filter((entity) => entity.alert !== undefined && entity.alert !== null)
        .length,
      header: decodedHeader(raw.header),
      raw
    })
  } catch (cause) {
    throw MtaDecodeError.make({
      feed: feed ?? "unknown",
      message: errorMessage(cause)
    })
  }
}
export const decodeGtfsRealtimeBytes = Effect.fn("Mta.decodeGtfsRealtimeBytes")(function* (
  bytes: Uint8Array,
  feed?: GtfsFeedKind
) {
  return yield* Effect.try({
    try: () => decodeGtfsRealtimeBytesSync(bytes, feed),
    catch: (cause) =>
      cause instanceof MtaDecodeError
        ? cause
        : MtaDecodeError.make({
            feed: feed ?? "unknown",
            message: errorMessage(cause)
          })
  })
})
export class GtfsRealtimeDecoder extends Context.Service<
  GtfsRealtimeDecoder,
  {
    readonly decode: GtfsRealtimeDecoderImplementation
  }
>()("@nyc-transit-kit/mta/GtfsRealtimeDecoder") {
  static readonly Live = Layer.succeed(GtfsRealtimeDecoder)({
    decode: decodeGtfsRealtimeBytes
  })
  // Test/custom fallback for callers that want to bypass protobuf decoding.
  static readonly Passthrough = Layer.succeed(GtfsRealtimeDecoder)({
    decode: (bytes, feed) =>
      Effect.succeed(
        MtaGtfsRealtimeDecodedSummary.make({
          ...(feed === undefined ? {} : { feed }),
          entityCount: 0,
          tripUpdateCount: 0,
          vehiclePositionCount: 0,
          alertCount: 0,
          raw: {
            byteLength: bytes.byteLength
          }
        })
      )
  })
}
const decodeRealtimeProbeRequest = decodeMtaInput("gtfs-realtime", MtaGtfsRealtimeProbeRequest)
const decodeRealtimeCaptureRequest = decodeMtaInput("gtfs-realtime", MtaGtfsRealtimeCaptureRequest)
const failGtfsRealtimeStatus = (status: number) =>
  MtaHttpError.make({
    operation: "gtfs-realtime",
    status,
    statusText: httpStatusText(status)
  })
const fetchGtfsRealtimeBytes = Effect.fn("Mta.fetchGtfsRealtimeBytes")(function* (request: {
  readonly feed: GtfsFeedKind
  readonly url: string
}) {
  const response = yield* requestWithPolicy(
    "gtfs-realtime",
    executeMtaRequest("gtfs-realtime", HttpClientRequest.get(request.url)),
    {
      retryableResult: (response) => retryableStatusError("gtfs-realtime", response.status)
    }
  )
  const buffer = yield* response.arrayBuffer.pipe(
    Effect.mapError(() =>
      MtaHttpError.make({
        operation: "gtfs-realtime",
        status: response.status,
        statusText: "Failed to read response body"
      })
    )
  )
  const bytes = new Uint8Array(buffer)
  return {
    response,
    bytes
  }
})
const sha256Hex = Effect.fn("Mta.sha256Hex")(function* (bytes: Uint8Array, feed: GtfsFeedKind) {
  const digest = yield* Effect.tryPromise({
    try: () => crypto.subtle.digest("SHA-256", arrayBufferFromBytes(bytes)),
    catch: (cause) =>
      MtaDecodeError.make({
        feed,
        message: `Failed to hash GTFS realtime capture: ${errorMessage(cause)}`
      })
  })
  return Array.from(new Uint8Array(digest), byteToHex).join("")
})
export const probeGtfsRealtime = Effect.fn("Mta.probeGtfsRealtime")(function* (
  input: MtaGtfsRealtimeProbeRequestInput
) {
  const request = yield* decodeRealtimeProbeRequest(input)
  const decoder = yield* GtfsRealtimeDecoder
  const { response, bytes } = yield* fetchGtfsRealtimeBytes(request)
  if (!isOkStatus(response.status)) {
    return MtaGtfsRealtimeProbeResult.make({
      feed: request.feed,
      ok: false,
      status: response.status,
      byteLength: bytes.byteLength
    })
  }
  const decoded = yield* decoder.decode(bytes, request.feed)
  return MtaGtfsRealtimeProbeResult.make({
    feed: request.feed,
    ok: true,
    status: response.status,
    byteLength: bytes.byteLength,
    decoded
  })
})
export const captureGtfsRealtime = Effect.fn("Mta.captureGtfsRealtime")(function* (
  input: MtaGtfsRealtimeCaptureRequestInput
) {
  const request = yield* decodeRealtimeCaptureRequest(input)
  const { response, bytes } = yield* fetchGtfsRealtimeBytes(request)
  if (!isOkStatus(response.status)) {
    return yield* failGtfsRealtimeStatus(response.status)
  }
  const sha256 = yield* sha256Hex(bytes, request.feed)
  return MtaGtfsRealtimeCaptureResult.make({
    feed: request.feed,
    status: response.status,
    byteLength: bytes.byteLength,
    sha256,
    capturedAt: new Date().toISOString(),
    url: redactedUrl(request.url),
    bytes
  })
})
