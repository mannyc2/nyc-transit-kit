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
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as GtfsRealtimeBindings from "gtfs-realtime-bindings"
import { MtaDecodeError, MtaHttpError, MtaInvalidInputError } from "./errors"

export type GtfsRealtimeDecoderImplementation = (
  bytes: Uint8Array,
  feed: GtfsFeedKind
) => Effect.Effect<unknown, MtaDecodeError>
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

const shouldRedactSearchParameter = (name: string) => {
  const lower = name.toLowerCase()
  return lower.includes("key") || lower.includes("token") || lower.includes("secret")
}

const redactGtfsRealtimeUrl = (url: string) => {
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

export const decodeGtfsRealtimeBytes = Effect.fn("Mta.decodeGtfsRealtimeBytes")(function* (
  bytes: Uint8Array,
  feed: GtfsFeedKind
) {
  return yield* Effect.try({
    try: () => {
      const raw = FeedMessage.decode(bytes)
      const entities = raw.entity

      return MtaGtfsRealtimeDecodedSummary.make({
        feed,
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
    },
    catch: (cause) =>
      MtaDecodeError.make({
        feed,
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
      Effect.succeed({
        feed,
        byteLength: bytes.byteLength
      })
  })
}

const decodeRealtimeInput =
  <S extends Schema.Top>(schema: S) =>
  (input: unknown) =>
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.catchTag("SchemaError", (error) =>
        Effect.fail(
          MtaInvalidInputError.make({
            operation: "gtfs-realtime",
            message: error.message
          })
        )
      )
    )

const decodeRealtimeProbeRequest = decodeRealtimeInput(MtaGtfsRealtimeProbeRequest)
const decodeRealtimeCaptureRequest = decodeRealtimeInput(MtaGtfsRealtimeCaptureRequest)

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

const fetchGtfsRealtimeBytes = Effect.fn("Mta.fetchGtfsRealtimeBytes")(function* (request: {
  readonly feed: GtfsFeedKind
  readonly url: string
}) {
  const response = yield* HttpClient.execute(HttpClientRequest.get(request.url)).pipe(
    Effect.mapError((error) => mapMtaHttpClientError("gtfs-realtime", error))
  )

  if (response.status < 200 || response.status >= 300) {
    return yield* MtaHttpError.make({
      operation: "gtfs-realtime",
      status: response.status,
      statusText: httpStatusText(response.status)
    })
  }

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
  const decoded = yield* decoder.decode(bytes, request.feed)

  return MtaGtfsRealtimeProbeResult.make({
    feed: request.feed,
    ok: response.status >= 200 && response.status < 300,
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
  const sha256 = yield* sha256Hex(bytes, request.feed)

  return MtaGtfsRealtimeCaptureResult.make({
    feed: request.feed,
    status: response.status,
    byteLength: bytes.byteLength,
    sha256,
    capturedAt: new Date().toISOString(),
    url: redactGtfsRealtimeUrl(request.url),
    bytes
  })
})
