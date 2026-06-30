import { describe, expect, test } from "bun:test"
import { UnsupportedDatasetError } from "@nyc-transit-kit/nyc-dot/errors"
import {
  facadeStyle,
  fetchMtaGtfsStaticBytes,
  isSoda3ClientError,
  isTransitKitCompatError,
  isUnsupportedDatasetError,
  ProviderHttpError,
  packageName,
  probeMtaGtfsRealtime,
  queryNycDotRows,
  querySoda3Rows
} from "../src/index"

type FetchInput = Parameters<typeof fetch>[0]
type FetchInit = Parameters<typeof fetch>[1]
type FetchHandler = (input: FetchInput, init?: FetchInit) => ReturnType<typeof fetch>

const makeFetch = (handler: FetchHandler): typeof fetch =>
  Object.assign(handler, {
    preconnect: fetch.preconnect
  })

const syntheticGtfsRealtimeBytes = () =>
  new Uint8Array([
    10, 7, 10, 3, 50, 46, 48, 24, 123, 18, 18, 10, 4, 116, 114, 105, 112, 26, 10, 10, 8, 10, 6, 116,
    114, 105, 112, 45, 49, 18, 21, 10, 7, 118, 101, 104, 105, 99, 108, 101, 34, 10, 10, 8, 10, 6,
    116, 114, 105, 112, 45, 49, 18, 9, 10, 5, 97, 108, 101, 114, 116, 42, 0
  ])

describe("@nyc-transit-kit/compat", () => {
  test("reserves a Promise facade package", () => {
    expect(packageName).toBe("@nyc-transit-kit/compat")
    expect(facadeStyle).toBe("promise-over-effect")
  })

  test("wraps SODA3 Effect programs with promises", async () => {
    const rows = await querySoda3Rows(
      {
        domain: "data.cityofnewyork.us",
        datasetId: "ycrg-ses3",
        query: "SELECT *"
      },
      {
        fetch: makeFetch(
          async () =>
            new Response(
              JSON.stringify({
                rows: [
                  {
                    street: "Main St"
                  }
                ]
              }),
              { status: 200 }
            )
        )
      }
    )

    expect(rows.rows).toHaveLength(1)
  })

  test("wraps MTA Effect programs with promises", async () => {
    const bytes = await fetchMtaGtfsStaticBytes(
      {
        url: "https://new.mta.info/feed.zip"
      },
      {
        fetch: makeFetch(async () => new Response("zip-bytes", { status: 200 }))
      }
    )

    expect(bytes.byteLength).toBe(9)
  })

  test("wraps MTA realtime probes with the default live decoder", async () => {
    const result = await probeMtaGtfsRealtime(
      {
        feed: "vehicle-positions",
        url: "https://api-endpoint.mta.info/realtime.pb"
      },
      {
        fetch: makeFetch(async () => new Response(syntheticGtfsRealtimeBytes(), { status: 200 }))
      }
    )

    expect(result.decoded?.entityCount).toBe(3)
    expect(result.decoded?.alertCount).toBe(1)
  })

  test("wraps NYC DOT delegation with promises", async () => {
    const rows = await queryNycDotRows(
      {
        name: "traffic-speeds",
        query: "SELECT *"
      },
      {
        fetch: makeFetch(
          async () =>
            new Response(
              JSON.stringify({
                rows: [
                  {
                    speed: "25"
                  }
                ]
              }),
              { status: 200 }
            )
        )
      }
    )

    expect(rows.rows).toHaveLength(1)
  })

  test("rejects unknown NYC DOT datasets with provider errors", async () => {
    const error = await queryNycDotRows({
      name: "unknown",
      query: "SELECT *"
    }).catch((failure: unknown) => failure)

    expect(isTransitKitCompatError(error)).toBe(true)
    expect(isUnsupportedDatasetError(error)).toBe(true)
    expect(error).toBeInstanceOf(UnsupportedDatasetError)
  })

  test("exports compat error helpers from the facade", async () => {
    const errorsModule = await import("../src/errors")
    const error = await querySoda3Rows(
      {
        domain: "data.cityofnewyork.us",
        datasetId: "ycrg-ses3",
        query: "SELECT *"
      },
      {
        fetch: makeFetch(async () => new Response("upstream failed", { status: 500 }))
      }
    ).catch((failure: unknown) => failure)

    expect(errorsModule.isTransitKitCompatError).toBe(isTransitKitCompatError)
    expect(isTransitKitCompatError(error)).toBe(true)
    expect(errorsModule.isSoda3ClientError).toBe(isSoda3ClientError)
    expect(isSoda3ClientError(error)).toBe(true)
    expect(error).toBeInstanceOf(ProviderHttpError)
    expect(isTransitKitCompatError({ _tag: "ProviderHttpError" })).toBe(false)
  })

  test("does not export the old NYC Open Data method bag", async () => {
    const source = await Bun.file(new URL("../src/index.ts", import.meta.url)).text()
    const compatModule = await import("../src/index")

    expect(source).not.toContain("effectNativeNycOpenData")
    expect("effectNativeNycOpenData" in compatModule).toBe(false)
  })
})
