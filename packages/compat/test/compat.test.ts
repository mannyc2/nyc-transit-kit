import { describe, expect, test } from "bun:test"
import {
  captureMtaGtfsRealtime,
  exportNycDotResponse,
  exportNycOpenDataResponse,
  facadeStyle,
  fetchMtaGtfsStaticBytes,
  fetchMtaGtfsStaticResponse,
  fetchMtaJsonDirect,
  isSoda3ClientError,
  isTransitKitCompatError,
  isUnsupportedDatasetError,
  ProviderHttpError,
  packageName,
  probeMtaGtfsRealtime,
  probeMtaGtfsStatic,
  queryMtaOpenDataRows,
  queryNycDotRows,
  queryNycOpenDataRows,
  querySoda3Rows,
  searchNycOpenData,
  TimeoutError,
  UnsupportedDatasetError
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

  test("wraps SODA3 timeout config with promises", async () => {
    const error = await querySoda3Rows(
      {
        domain: "data.cityofnewyork.us",
        datasetId: "ycrg-ses3",
        query: "SELECT *"
      },
      {
        timeoutMs: 1,
        fetch: makeFetch(() => new Promise<Response>(() => {}))
      }
    ).catch((failure: unknown) => failure)

    expect(error).toBeInstanceOf(TimeoutError)
    expect(isTransitKitCompatError(error)).toBe(true)
    expect(isSoda3ClientError(error)).toBe(true)
    expect(
      isTransitKitCompatError({ _tag: "TimeoutError", operation: "query", timeoutMs: 1 })
    ).toBe(false)
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

  test("wraps MTA static probes and raw responses with promises", async () => {
    const requests: Array<Request> = []
    const options = {
      fetch: makeFetch(async (input, init) => {
        const request = input instanceof Request ? input : new Request(input.toString(), init)
        requests.push(request)
        return new Response("zip-bytes", {
          status: 200,
          headers: {
            "content-length": "9",
            "content-type": "application/zip"
          }
        })
      })
    }

    const probe = await probeMtaGtfsStatic(
      {
        url: "https://new.mta.info/feed.zip"
      },
      options
    )
    const response = await fetchMtaGtfsStaticResponse(
      {
        url: "https://new.mta.info/feed.zip"
      },
      options
    )

    expect(probe.contentType).toBe("application/zip")
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("zip-bytes")
    expect(requests.map((request) => request.method)).toEqual(["HEAD", "GET"])
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

  test("wraps MTA realtime capture with promises", async () => {
    const result = await captureMtaGtfsRealtime(
      {
        feed: "vehicle-positions",
        url: "https://api-endpoint.mta.info/realtime.pb?key=secret-token"
      },
      {
        fetch: makeFetch(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
      }
    )

    expect(result.byteLength).toBe(3)
    expect(result.url).toBe("https://api-endpoint.mta.info/realtime.pb?key=REDACTED")
    expect([...result.bytes]).toEqual([1, 2, 3])
  })

  test("wraps MTA JSON direct feeds with promises", async () => {
    const result = await fetchMtaJsonDirect(
      {
        surface: "bus-time",
        url: "https://bustime.mta.info/api/siri/vehicle-monitoring.json?token=existing-secret",
        apiKey: "secret-token",
        apiKeyParameterName: "apiKey",
        query: {
          LineRef: "MTA NYCT_M15"
        }
      },
      {
        fetch: makeFetch(async () =>
          Response.json(
            {
              Siri: {
                ServiceDelivery: {}
              }
            },
            {
              headers: {
                "content-type": "application/json"
              }
            }
          )
        )
      }
    )

    expect(result.surface).toBe("bus-time")
    expect(result.contentType).toBe("application/json")
    expect(result.url).toContain("apiKey=REDACTED")
    expect(result.url).toContain("token=REDACTED")
  })

  test("wraps NYC DOT delegation with promises", async () => {
    const requests: Array<Request> = []
    const rows = await queryNycDotRows(
      {
        name: "traffic-speeds",
        query: "SELECT *",
        page: {
          pageNumber: 2,
          pageSize: 10
        }
      },
      {
        fetch: makeFetch(async (input, init) => {
          const request = input instanceof Request ? input : new Request(input.toString(), init)
          requests.push(request)
          return new Response(
            JSON.stringify({
              rows: [
                {
                  speed: "25"
                }
              ]
            }),
            { status: 200 }
          )
        })
      }
    )

    expect(rows.rows).toHaveLength(1)
    expect(await requests[0]?.json()).toEqual({
      query: "SELECT *",
      page: {
        pageNumber: 2,
        pageSize: 10
      }
    })
  })

  test("wraps NYC DOT exports with promises", async () => {
    const response = await exportNycDotResponse(
      {
        name: "traffic-speeds",
        format: "csv",
        query: "SELECT *",
        range: {
          start: 0,
          end: 10
        }
      },
      {
        fetch: makeFetch(async () => new Response("speed\n25\n", { status: 206 }))
      }
    )

    expect(response.status).toBe(206)
    expect(await response.text()).toContain("speed")
  })

  test("wraps NYC Open Data query, search, and export with promises", async () => {
    const requests: Array<Request> = []
    const rows = await queryNycOpenDataRows(
      {
        datasetId: "ycrg-ses3",
        query: "SELECT *",
        page: {
          pageNumber: 3,
          pageSize: 5
        }
      },
      {
        fetch: makeFetch(async (input, init) => {
          const request = input instanceof Request ? input : new Request(input.toString(), init)
          requests.push(request)
          return Response.json({
            rows: [
              {
                street: "Main St"
              }
            ]
          })
        })
      }
    )
    const search = await searchNycOpenData(
      {
        query: "bus lanes",
        limit: 1,
        offset: 2
      },
      {
        fetch: makeFetch(async (input, init) => {
          const request = input instanceof Request ? input : new Request(input.toString(), init)
          requests.push(request)
          return Response.json({
            results: [
              {
                resource: {
                  id: "ycrg-ses3",
                  name: "Bus Lanes",
                  domain: "data.cityofnewyork.us",
                  type: "dataset"
                }
              }
            ],
            resultCount: 1
          })
        })
      }
    )
    const response = await exportNycOpenDataResponse(
      {
        datasetId: "ycrg-ses3",
        format: "csv"
      },
      {
        fetch: makeFetch(async (input, init) => {
          const request = input instanceof Request ? input : new Request(input.toString(), init)
          requests.push(request)
          return new Response("street\nMain St\n", { status: 200 })
        })
      }
    )

    expect(rows.rows).toHaveLength(1)
    expect(search.resultCount).toBe(1)
    expect(new URL(requests[1]?.url ?? "https://example.test").searchParams.get("offset")).toBe("2")
    expect(response.status).toBe(200)
    expect(await response.text()).toContain("Main St")
  })

  test("wraps MTA Open Data SODA3 delegation with promises", async () => {
    const requests: Array<Request> = []
    const rows = await queryMtaOpenDataRows(
      {
        datasetId: "f462-ka72",
        query: "SELECT *",
        page: {
          pageNumber: 1,
          pageSize: 1
        }
      },
      {
        appToken: "secret-token",
        fetch: makeFetch(async (input, init) => {
          const request = input instanceof Request ? input : new Request(input.toString(), init)
          requests.push(request)
          return Response.json({
            rows: [
              {
                dataset: "catalog"
              }
            ]
          })
        })
      }
    )

    expect(rows.rows).toHaveLength(1)
    expect(requests[0]?.url).toBe("https://data.ny.gov/api/v3/views/f462-ka72/query.json")
    expect(requests[0]?.headers.get("X-App-Token")).toBe("secret-token")
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
