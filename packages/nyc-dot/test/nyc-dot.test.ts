import { describe, expect, test } from "bun:test"
import { Soda3ClientConfig } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import {
  busLanesLocalStreets,
  decodeBusLaneRow,
  decodeTrafficSpeedRow,
  decodeTrafficVolumeRow,
  findNycDotDataset,
  initialDatasetIds,
  nycDotDatasets,
  nycDotOpenDataDomain,
  packageName,
  queryNycDotDataset,
  trafficSpeeds,
  trafficVolumeCounts,
  UnsupportedDatasetError
} from "../src/index"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

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

describe("@nyc-transit-kit/nyc-dot", () => {
  test("declares initial DOT dataset descriptors", () => {
    expect(packageName).toBe("@nyc-transit-kit/nyc-dot")
    expect(initialDatasetIds).toContain("ycrg-ses3")
    expect(initialDatasetIds).toContain("i4gi-tjb9")
    expect(initialDatasetIds).toContain("btm5-ppia")
    expect(busLanesLocalStreets.sourceUrl).toBe("https://data.cityofnewyork.us/d/ycrg-ses3")
    expect(busLanesLocalStreets.adapterStatus).toBe("row-schema")
    expect(trafficSpeeds.temporalFields).toEqual(["data_as_of"])
    expect(String(trafficVolumeCounts.lastVerified)).toBe("2026-06-16")
  })

  test("looks up DOT descriptors by name or id", () => {
    expect(findNycDotDataset("bus-lanes-local-streets")?.title).toBe("Bus Lanes - Local Streets")
    expect(String(findNycDotDataset("i4gi-tjb9")?.name)).toBe("traffic-speeds")
  })

  test("keeps DOT dataset descriptors registry-safe", () => {
    const datasetIds = nycDotDatasets.map((dataset) => String(dataset.id))
    const datasetNames = nycDotDatasets.map((dataset) => String(dataset.name))

    expect(nycDotDatasets.length).toBeGreaterThan(0)
    expect(new Set(datasetIds).size).toBe(datasetIds.length)
    expect(new Set(datasetNames).size).toBe(datasetNames.length)
    expect(String(busLanesLocalStreets.id)).toBe("ycrg-ses3")
    expect(String(trafficSpeeds.id)).toBe("i4gi-tjb9")
    expect(String(trafficVolumeCounts.id)).toBe("btm5-ppia")
    expect(findNycDotDataset("traffic-speeds")?.title).toBe("DOT Traffic Speeds")
    expect(String(findNycDotDataset("i4gi-tjb9")?.name)).toBe("traffic-speeds")

    for (const dataset of nycDotDatasets) {
      expect(String(dataset.domain)).toBe(nycDotOpenDataDomain)
      expect(dataset.backing).toBe("socrata")
      expect(String(dataset.name)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  test("decodes thin DOT DTO adapters", async () => {
    const busLane = await Effect.runPromise(
      decodeBusLaneRow({
        street: "Main St",
        borough: "Queens"
      })
    )
    const speed = await Effect.runPromise(
      decodeTrafficSpeedRow({
        linkId: "1",
        speed: "25"
      })
    )
    const volume = await Effect.runPromise(
      decodeTrafficVolumeRow({
        requestId: "count-1",
        roadwayName: "Main St"
      })
    )

    expect(busLane.street).toBe("Main St")
    expect(speed.speed).toBe("25")
    expect(volume.roadwayName).toBe("Main St")
  })

  test("delegates DOT dataset queries directly through SODA3", async () => {
    const requests: Array<Request> = []
    const layer = Layer.mergeAll(
      Soda3ClientConfig.Default,
      fetchLayer(async (input, init) => {
        const request = requestFromFetchInput(input, init)
        requests.push(request)
        return new Response(
          JSON.stringify({
            rows: [
              {
                street: "Main St"
              }
            ]
          }),
          { status: 200 }
        )
      })
    )

    const result = await Effect.runPromise(
      queryNycDotDataset({
        name: "bus-lanes-local-streets",
        query: "SELECT *"
      }).pipe(Effect.provide(layer))
    )

    expect(result.rows).toHaveLength(1)
    expect(requests[0]?.url).toBe("https://data.cityofnewyork.us/api/v3/views/ycrg-ses3/query.json")
  })

  test("returns typed errors for unknown DOT datasets", async () => {
    const layer = Layer.mergeAll(
      Soda3ClientConfig.Default,
      fetchLayer(async () => new Response("not used", { status: 200 }))
    )
    const error = await Effect.runPromise(
      queryNycDotDataset({
        name: "unknown",
        query: "SELECT *"
      }).pipe(
        Effect.provide(layer),
        Effect.match({
          onFailure: (failure) => failure,
          onSuccess: () => undefined
        })
      )
    )

    expect(error).toBeInstanceOf(UnsupportedDatasetError)
  })

  test("does not declare an NYC Open Data runtime dependency", async () => {
    const manifest: unknown = JSON.parse(
      await Bun.file(new URL("../package.json", import.meta.url)).text()
    )
    const dependencies = isRecord(manifest) ? manifest.dependencies : undefined

    expect(
      isRecord(dependencies) ? dependencies["@nyc-transit-kit/nyc-open-data"] : undefined
    ).toBeUndefined()
  })
})
