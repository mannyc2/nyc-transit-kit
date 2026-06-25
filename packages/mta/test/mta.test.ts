import { describe, expect, test } from "bun:test"
import {
  MtaGtfsRealtimeDecodedSummary,
  type MtaGtfsRealtimeProbeRequestInput,
  type MtaGtfsStaticFetchRequestInput
} from "@nyc-transit-kit/contracts/mta"
import { Soda3ClientConfig } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as GtfsRealtimeBindings from "gtfs-realtime-bindings"
import {
  captureGtfsRealtime,
  decodeGtfsRealtimeBytes,
  fetchGtfsStatic,
  fetchGtfsStaticResponse,
  findMtaGtfsRealtimeFeed,
  findMtaGtfsStaticFeed,
  findMtaOpenDataDataset,
  GtfsRealtimeDecoder,
  gtfsRealtimeSurface,
  gtfsStaticSurface,
  MtaDecodeError,
  mtaDirectFeeds,
  mtaGtfsRealtimeFeeds,
  mtaGtfsStaticFeeds,
  mtaOpenDataCatalogDescriptor,
  mtaOpenDataDatasets,
  mtaOpenDataDomain,
  packageName,
  probeGtfsRealtime,
  probeGtfsStatic,
  queryMtaOpenData
} from "../src/index"

const FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage

const syntheticGtfsRealtimeBytes = () =>
  FeedMessage.encode(
    FeedMessage.create({
      header: {
        gtfsRealtimeVersion: "2.0",
        timestamp: 123
      },
      entity: [
        {
          id: "trip",
          tripUpdate: {
            trip: {
              tripId: "trip-1"
            }
          }
        },
        {
          id: "vehicle",
          vehicle: {
            trip: {
              tripId: "trip-1"
            }
          }
        },
        {
          id: "alert",
          alert: {}
        }
      ]
    })
  ).finish()

const gtfsStaticFixture = {
  url: "https://new.mta.info/feed.zip"
} satisfies MtaGtfsStaticFetchRequestInput

const gtfsRealtimeFixture = {
  feed: "vehicle-positions",
  url: "https://api-endpoint.mta.info/realtime.pb"
} satisfies MtaGtfsRealtimeProbeRequestInput

type FetchInput = Parameters<typeof fetch>[0]
type FetchInit = Parameters<typeof fetch>[1]
type FetchHandler = (input: FetchInput, init?: FetchInit) => ReturnType<typeof fetch>

const makeFetch = (handler: FetchHandler): typeof fetch =>
  Object.assign(handler, {
    preconnect: fetch.preconnect
  })

const requestFromFetchInput = (input: FetchInput, init?: FetchInit) =>
  input instanceof Request ? input : new Request(input.toString(), init)

const fetchLayer = (handler: FetchHandler) =>
  FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, makeFetch(handler)))
  )

describe("@nyc-transit-kit/mta", () => {
  test("declares official MTA feed surfaces", () => {
    expect(packageName).toBe("@nyc-transit-kit/mta")
    expect(gtfsStaticSurface).toBe("gtfs-static")
    expect(gtfsRealtimeSurface).toBe("gtfs-realtime")
  })

  test("declares MTA Open Data descriptors", () => {
    expect(String(mtaOpenDataCatalogDescriptor.id)).toBe("f462-ka72")
    expect(findMtaOpenDataDataset("f462-ka72")?.name).toBe("MTA Open Data Catalog")
    expect(mtaOpenDataCatalogDescriptor.sourceUrl).toBe("https://data.ny.gov/d/f462-ka72")
    expect(mtaOpenDataCatalogDescriptor.adapterStatus).toBe("none")
    expect(String(mtaOpenDataCatalogDescriptor.lastVerified)).toBe("2026-06-16")
  })

  test("keeps MTA Open Data descriptors registry-safe", () => {
    const datasetIds = mtaOpenDataDatasets.map((dataset) => String(dataset.id))

    expect(mtaOpenDataDatasets.length).toBeGreaterThan(0)
    expect(new Set(datasetIds).size).toBe(datasetIds.length)
    expect(String(mtaOpenDataCatalogDescriptor.id)).toBe("f462-ka72")
    expect(findMtaOpenDataDataset("f462-ka72")?.name).toBe("MTA Open Data Catalog")

    for (const dataset of mtaOpenDataDatasets) {
      expect(String(dataset.domain)).toBe(mtaOpenDataDomain)
      expect(dataset.backing).toBe("socrata")
    }
  })

  test("declares MTA direct feed descriptors", () => {
    expect(mtaGtfsStaticFeeds.length).toBeGreaterThan(0)
    expect(mtaGtfsRealtimeFeeds.length).toBeGreaterThan(0)
    expect(mtaDirectFeeds.length).toBeGreaterThan(
      mtaGtfsStaticFeeds.length + mtaGtfsRealtimeFeeds.length
    )
    expect(findMtaGtfsStaticFeed("subway-regular")?.url).toBe(
      "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip"
    )
    expect(findMtaGtfsRealtimeFeed("alerts-all")?.feed).toBe("alerts")
  })

  test("probes and fetches GTFS static through injected fetch", async () => {
    const requests: Array<Request> = []
    const layer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return new Response("zip-bytes", {
        status: 200,
        headers: {
          "content-length": "9",
          "content-type": "application/zip"
        }
      })
    })

    const probe = await Effect.runPromise(
      probeGtfsStatic(gtfsStaticFixture).pipe(Effect.provide(layer))
    )
    const body = await Effect.runPromise(
      fetchGtfsStatic(gtfsStaticFixture).pipe(Effect.provide(layer))
    )
    const response = await Effect.runPromise(
      fetchGtfsStaticResponse(gtfsStaticFixture).pipe(Effect.provide(layer))
    )

    expect(probe.contentType).toBe("application/zip")
    expect(body.byteLength).toBe(9)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("zip-bytes")
    expect(requests.map((request) => request.method)).toEqual(["HEAD", "GET", "GET"])
  })

  test("probes GTFS realtime with decoder injection", async () => {
    const httpLayer = fetchLayer(
      async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    )
    const decoderLayer = Layer.succeed(GtfsRealtimeDecoder)({
      decode: (bytes, feed) =>
        Effect.succeed(
          MtaGtfsRealtimeDecodedSummary.make({
            feed,
            entityCount: bytes.byteLength,
            tripUpdateCount: 0,
            vehiclePositionCount: 0,
            alertCount: 0,
            raw: {
              decodedBytes: bytes.byteLength
            }
          })
        )
    })

    const result = await Effect.runPromise(
      probeGtfsRealtime(gtfsRealtimeFixture).pipe(
        Effect.provide(Layer.mergeAll(httpLayer, decoderLayer))
      )
    )

    expect(result.byteLength).toBe(3)
    expect(result.feed).toBe("vehicle-positions")
    expect(result.decoded?.entityCount).toBe(3)
  })

  test("reports non-2xx GTFS realtime probes without decoding", async () => {
    let decodeCalls = 0
    const httpLayer = fetchLayer(async () => new Response("unavailable", { status: 503 }))
    const decoderLayer = Layer.succeed(GtfsRealtimeDecoder)({
      decode: () => {
        decodeCalls += 1
        return Effect.succeed(
          MtaGtfsRealtimeDecodedSummary.make({
            feed: "vehicle-positions",
            entityCount: 0,
            tripUpdateCount: 0,
            vehiclePositionCount: 0,
            alertCount: 0,
            raw: {}
          })
        )
      }
    })

    const result = await Effect.runPromise(
      probeGtfsRealtime(gtfsRealtimeFixture).pipe(
        Effect.provide(Layer.mergeAll(httpLayer, decoderLayer))
      )
    )

    expect(result.ok).toBe(false)
    expect(result.status).toBe(503)
    expect(result.byteLength).toBe(11)
    expect(result.decoded).toBeUndefined()
    expect(decodeCalls).toBe(0)
  })

  test("captures GTFS realtime raw bytes with manifest metadata", async () => {
    const requests: Array<Request> = []
    const httpLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    })

    const result = await Effect.runPromise(
      captureGtfsRealtime({
        ...gtfsRealtimeFixture,
        url: "https://api-endpoint.mta.info/realtime.pb?key=secret-token&route=M15"
      }).pipe(Effect.provide(httpLayer))
    )

    expect(result.feed).toBe("vehicle-positions")
    expect(result.status).toBe(200)
    expect(result.byteLength).toBe(3)
    expect(result.sha256).toBe("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81")
    expect(result.capturedAt.endsWith("Z")).toBe(true)
    expect(result.url).toBe("https://api-endpoint.mta.info/realtime.pb?key=REDACTED&route=M15")
    expect(result.url).not.toContain("secret-token")
    expect([...result.bytes]).toEqual([1, 2, 3])
    expect(requests[0]?.method).toBe("GET")
  })

  test("decodes GTFS realtime feeds with the live decoder", async () => {
    const result = await Effect.runPromise(
      decodeGtfsRealtimeBytes(syntheticGtfsRealtimeBytes(), "vehicle-positions")
    )

    expect(result.entityCount).toBe(3)
    expect(result.tripUpdateCount).toBe(1)
    expect(result.vehiclePositionCount).toBe(1)
    expect(result.alertCount).toBe(1)
    expect(result.header?.gtfsRealtimeVersion).toBe("2.0")
    expect(result.header?.timestamp).toBe(123)
  })

  test("returns typed decode errors for invalid GTFS realtime bytes", async () => {
    const error = await Effect.runPromise(
      decodeGtfsRealtimeBytes(new Uint8Array([1, 2, 3]), "alerts").pipe(
        Effect.match({
          onFailure: (failure) => failure,
          onSuccess: () => undefined
        })
      )
    )

    expect(error).toBeInstanceOf(MtaDecodeError)
  })

  test("probes GTFS realtime with the live decoder layer", async () => {
    const httpLayer = fetchLayer(
      async () => new Response(syntheticGtfsRealtimeBytes(), { status: 200 })
    )

    const result = await Effect.runPromise(
      probeGtfsRealtime(gtfsRealtimeFixture).pipe(
        Effect.provide(Layer.mergeAll(httpLayer, GtfsRealtimeDecoder.Live))
      )
    )

    expect(result.byteLength).toBeGreaterThan(0)
    expect(result.decoded?.entityCount).toBe(3)
    expect(result.decoded?.vehiclePositionCount).toBe(1)
  })

  test("delegates MTA Open Data queries through SODA3", async () => {
    const requests: Array<Request> = []
    const sodaLayer = Layer.mergeAll(
      Soda3ClientConfig.Default,
      fetchLayer(async (input, init) => {
        const request = requestFromFetchInput(input, init)
        requests.push(request)
        return new Response(
          JSON.stringify({
            rows: [
              {
                dataset: "catalog"
              }
            ]
          }),
          { status: 200 }
        )
      })
    )

    const result = await Effect.runPromise(
      queryMtaOpenData({
        datasetId: "f462-ka72",
        query: "SELECT *"
      }).pipe(Effect.provide(sodaLayer))
    )

    expect(result.rows).toHaveLength(1)
    expect(requests[0]?.url).toBe("https://data.ny.gov/api/v3/views/f462-ka72/query.json")
  })
})
