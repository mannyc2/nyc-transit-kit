/**
 * MTA GTFS-realtime feeds: protobuf `FeedMessage`s for trip updates and alerts.
 */
import * as Crypto from "effect/Crypto"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Hex from "effect/encoding/Hex"
import * as HttpClient from "effect/http/HttpClient"
import * as Schema from "effect/Schema"
import * as GtfsRealtimeBindings from "gtfs-realtime-bindings"

export interface Feed {
  readonly title: string
  readonly kind: "trip-updates" | "alerts"
  readonly url: string
}

const dataservice = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/"

const tripUpdates = (title: string, path: string): Feed => ({
  title,
  kind: "trip-updates",
  url: `${dataservice}${path}`
})

const alerts = (title: string, path: string): Feed => ({
  title,
  kind: "alerts",
  url: `${dataservice}${path}`
})

export const feeds = {
  "subway-ace": tripUpdates("Subway A/C/E", "nyct%2Fgtfs-ace"),
  "subway-bdfm": tripUpdates("Subway B/D/F/M", "nyct%2Fgtfs-bdfm"),
  "subway-g": tripUpdates("Subway G", "nyct%2Fgtfs-g"),
  "subway-jz": tripUpdates("Subway J/Z", "nyct%2Fgtfs-jz"),
  "subway-nqrw": tripUpdates("Subway N/Q/R/W", "nyct%2Fgtfs-nqrw"),
  "subway-l": tripUpdates("Subway L", "nyct%2Fgtfs-l"),
  "subway-1234567": tripUpdates("Subway 1/2/3/4/5/6/7", "nyct%2Fgtfs"),
  "staten-island-railway": tripUpdates("Staten Island Railway", "nyct%2Fgtfs-si"),
  lirr: tripUpdates("Long Island Rail Road", "lirr%2Fgtfs-lirr"),
  "metro-north": tripUpdates("Metro-North Railroad", "mnr%2Fgtfs-mnr"),
  "alerts-all": alerts("All MTA service alerts", "camsys%2Fall-alerts"),
  "alerts-subway": alerts("Subway service alerts", "camsys%2Fsubway-alerts"),
  "alerts-bus": alerts("Bus service alerts", "camsys%2Fbus-alerts"),
  "alerts-lirr": alerts("LIRR service alerts", "camsys%2Flirr-alerts"),
  "alerts-metro-north": alerts("Metro-North service alerts", "camsys%2Fmnr-alerts")
} satisfies Record<string, Feed>
export type FeedName = keyof typeof feeds

const { FeedHeader, FeedMessage } = GtfsRealtimeBindings.transit_realtime
export type FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage

export class GtfsRealtimeDecodeError extends Schema.TaggedError<GtfsRealtimeDecodeError>()(
  "GtfsRealtimeDecodeError",
  { cause: Schema.Defect() }
) {
  override get message() {
    return `The bytes are not a GTFS-realtime FeedMessage (${this.cause})`
  }
}

export const decode = (bytes: Uint8Array) =>
  Effect.try({
    try: () => FeedMessage.decode(bytes),
    catch: (cause) => new GtfsRealtimeDecodeError({ cause })
  })

/** The feed as plain JSON: 64-bit integers become numbers and enums become their names. */
export const toJson = (message: FeedMessage): { readonly [key: string]: unknown } =>
  FeedMessage.toObject(message, { longs: Number, enums: String })

/** What the feed holds, counted. */
export const summarize = (message: FeedMessage) => {
  const header: { readonly incrementality?: string; readonly timestamp?: number } =
    FeedHeader.toObject(FeedHeader.create(message.header), { longs: Number, enums: String })
  const count = (has: (entity: (typeof message.entity)[number]) => unknown) =>
    message.entity.filter((entity) => has(entity) != null).length
  return {
    gtfsRealtimeVersion: message.header.gtfsRealtimeVersion,
    incrementality: header.incrementality ?? "FULL_DATASET",
    timestamp: header.timestamp ?? null,
    entities: message.entity.length,
    tripUpdates: count((entity) => entity.tripUpdate),
    vehicles: count((entity) => entity.vehicle),
    alerts: count((entity) => entity.alert)
  }
}

export const fetchBytes = Effect.fn("GtfsRealtime.fetchBytes")(function* (url: string) {
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)
  const response = yield* client.get(url)
  return new Uint8Array(yield* response.arrayBuffer)
})

export const fetchMessage = Effect.fn("GtfsRealtime.fetchMessage")(function* (url: string) {
  return yield* decode(yield* fetchBytes(url))
})

/** Written beside captured bytes so that they can be traced to the fetch. */
export const CaptureManifest = Schema.Struct({
  feed: Schema.String,
  url: Schema.String,
  byteLength: Schema.Int,
  sha256: Schema.String.check(
    Schema.isPattern(/^[a-f0-9]{64}$/, { message: "Expected a lowercase SHA-256 hex digest" })
  ),
  capturedAt: Schema.DateTimeUtcFromString
})
export type CaptureManifest = typeof CaptureManifest.Type

/** Raw bytes for replay, and a manifest that ties them to the fetch. Fails unless the bytes decode. */
export const capture = Effect.fn("GtfsRealtime.capture")(function* (feed: string, url: string) {
  const bytes = yield* fetchBytes(url)
  yield* decode(bytes)
  const crypto = yield* Crypto.Crypto
  const digest = yield* crypto.digest("SHA-256", bytes)
  const manifest: CaptureManifest = {
    feed,
    url,
    byteLength: bytes.byteLength,
    sha256: Hex.encode(digest),
    capturedAt: yield* DateTime.now
  }
  return { bytes, manifest }
})
