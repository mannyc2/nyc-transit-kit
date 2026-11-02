import * as BunCrypto from "@effect/platform-bun/BunCrypto"
import { describe, expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as TestClock from "effect/testing/TestClock"
import * as GtfsRealtime from "../src/GtfsRealtime"

const lirr = GtfsRealtime.feeds.lirr.url
// What the MTA answers, with HTTP 200, for a feed path it does not serve.
const notAFeed = new TextEncoder().encode(Samples.mtaFeedNoSuchKey)

describe("decoding", () => {
  it.effect("a summary counts what the feed holds", () =>
    Effect.gen(function* () {
      const trains = yield* GtfsRealtime.decode(Samples.statenIslandRailwayFeed)
      // NYCT omits incrementality; GTFS-realtime defaults it to FULL_DATASET.
      expect(GtfsRealtime.summarize(trains)).toEqual({
        gtfsRealtimeVersion: "1.0",
        incrementality: "FULL_DATASET",
        timestamp: 1793103872,
        entities: 3,
        tripUpdates: 2,
        vehicles: 1,
        alerts: 0
      })
      const alerts = yield* GtfsRealtime.decode(Samples.lirrAlertsFeed)
      expect(GtfsRealtime.summarize(alerts)).toMatchObject({
        entities: 1,
        tripUpdates: 0,
        alerts: 1
      })
    })
  )

  it.effect("the JSON form keeps every entity, with plain numbers and enum names", () =>
    Effect.gen(function* () {
      const json = GtfsRealtime.toJson(yield* GtfsRealtime.decode(Samples.lirrAlertsFeed))
      expect(json.header).toEqual({
        gtfsRealtimeVersion: "2.0",
        incrementality: "FULL_DATASET",
        timestamp: 1793101602
      })
      expect(json.entity).toHaveLength(1)
    })
  )

  it.effect("bytes that are not a FeedMessage fail to decode", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(GtfsRealtime.decode(notAFeed))
      expect(error._tag).toBe("GtfsRealtimeDecodeError")
    })
  )
})

describe("fetching", () => {
  it.effect("fetches and decodes a feed", () =>
    Effect.gen(function* () {
      const message = yield* GtfsRealtime.fetchMessage(lirr)
      expect(message.entity).toHaveLength(1)
      const [request] = yield* HttpTest.requests
      expect(request?.method).toBe("GET")
      expect(request?.url.href).toBe(lirr)
    }).pipe(Effect.provide(HttpTest.layer(() => new Response(Samples.lirrAlertsFeed))))
  )

  it.effect("a feed path the MTA does not serve answers 200, and fails to decode", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(GtfsRealtime.fetchMessage(`${lirr}-missing`))
      expect(error._tag).toBe("GtfsRealtimeDecodeError")
    }).pipe(
      Effect.provide(
        HttpTest.layer(
          () =>
            new Response(Samples.mtaFeedNoSuchKey, {
              headers: { "content-type": "application/xml" }
            })
        )
      )
    )
  )

  it.effect("a refused fetch fails with its status", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(GtfsRealtime.fetchBytes(lirr))
      expect(error.reason._tag).toBe("StatusCodeError")
    }).pipe(
      Effect.provide(
        HttpTest.layer(() => Response.json(Samples.mtaGatewayForbidden, { status: 403 }))
      )
    )
  )
})

describe("capture", () => {
  const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex")

  it.effect("the manifest ties the bytes to the fetch and the clock", () =>
    Effect.gen(function* () {
      const capturedAt = DateTime.makeUnsafe("2026-10-27T13:44:32Z")
      yield* TestClock.setTime(DateTime.toEpochMillis(capturedAt))
      const { bytes, manifest } = yield* GtfsRealtime.capture("lirr", lirr)
      expect(bytes).toEqual(Samples.lirrAlertsFeed)
      expect(manifest).toEqual({
        feed: "lirr",
        url: lirr,
        byteLength: Samples.lirrAlertsFeed.byteLength,
        sha256: sha256(Samples.lirrAlertsFeed),
        capturedAt
      })
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          HttpTest.layer(() => new Response(Samples.lirrAlertsFeed)),
          BunCrypto.layer
        )
      )
    )
  )

  it.effect("bytes that are not GTFS-realtime are not captured", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(GtfsRealtime.capture("lirr", lirr))
      expect(error._tag).toBe("GtfsRealtimeDecodeError")
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          HttpTest.layer(() => new Response(notAFeed)),
          BunCrypto.layer
        )
      )
    )
  )
})
