import { describe, expect, test } from "bun:test"
import { Soda3ClientConfig } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import {
  busLanesLocalStreetsDescriptor,
  defaultDomain,
  dotTrafficSpeedsDescriptor,
  findNycOpenDataDataset,
  knownNycOpenDataDatasets,
  packageName,
  queryNycOpenDataDataset,
  searchNycOpenDataCatalog,
  trafficVolumeCountsDescriptor
} from "../src/index"

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

describe("@nyc-transit-kit/nyc-open-data", () => {
  test("declares the NYC Open Data domain", () => {
    expect(packageName).toBe("@nyc-transit-kit/nyc-open-data")
    expect(defaultDomain).toBe("data.cityofnewyork.us")
  })

  test("keeps provider-owned datasets out of the generic descriptor registry", () => {
    const datasetIds = knownNycOpenDataDatasets.map((dataset) => String(dataset.id))

    expect(knownNycOpenDataDatasets).toEqual([])
    expect(findNycOpenDataDataset("ycrg-ses3")).toBeUndefined()
    expect(findNycOpenDataDataset("i4gi-tjb9")).toBeUndefined()
    expect(findNycOpenDataDataset("btm5-ppia")).toBeUndefined()
    expect(new Set(datasetIds).size).toBe(datasetIds.length)

    for (const dataset of knownNycOpenDataDatasets) {
      expect(String(dataset.domain)).toBe(defaultDomain)
      expect(dataset.backing).toBe("socrata")
    }
  })

  test("keeps deprecated DOT descriptor aliases outside the generic registry", () => {
    expect(String(busLanesLocalStreetsDescriptor.id)).toBe("ycrg-ses3")
    expect(String(dotTrafficSpeedsDescriptor.id)).toBe("i4gi-tjb9")
    expect(String(trafficVolumeCountsDescriptor.id)).toBe("btm5-ppia")
    expect(knownNycOpenDataDatasets).not.toContain(busLanesLocalStreetsDescriptor)
  })

  test("delegates dataset queries through SODA3", async () => {
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
      queryNycOpenDataDataset({
        datasetId: "ycrg-ses3",
        query: "SELECT *"
      }).pipe(Effect.provide(layer))
    )

    expect(result.rows).toHaveLength(1)
    expect(requests[0]?.url).toBe("https://data.cityofnewyork.us/api/v3/views/ycrg-ses3/query.json")
  })

  test("delegates catalog searches through SODA3 discovery", async () => {
    const requests: Array<Request> = []
    const layer = Layer.mergeAll(
      Soda3ClientConfig.Default,
      fetchLayer(async (input, init) => {
        const request = requestFromFetchInput(input, init)
        requests.push(request)
        return new Response(
          JSON.stringify({
            results: [
              {
                resource: {
                  id: "ycrg-ses3",
                  name: "Bus Lanes - Local Streets",
                  domain: defaultDomain,
                  type: "dataset"
                }
              }
            ],
            resultCount: 1
          }),
          { status: 200 }
        )
      })
    )

    const result = await Effect.runPromise(
      searchNycOpenDataCatalog({ query: "bus lanes", limit: 1 }).pipe(Effect.provide(layer))
    )

    expect(result.resultCount).toBe(1)
    expect(requests[0]?.url).toContain("api.us.socrata.com/api/catalog/v1")
  })
})
