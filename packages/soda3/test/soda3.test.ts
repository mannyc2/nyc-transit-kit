import { describe, expect, test } from "bun:test"
import type {
  Soda3CatalogSearchRequestInput,
  Soda3ExportRequestInput,
  Soda3QueryRequestInput
} from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type { FetchImplementation } from "../src/index"
import {
  buildCatalogSearchUrl,
  buildExportUrl,
  buildQueryUrl,
  catalogSearch,
  countRows,
  defaultSocrataProtocol,
  exportResponse,
  fetchDatasetMetadata,
  InvalidInputError,
  ProviderContractError,
  ProviderHttpError,
  packageName,
  queryAllRows,
  queryRows,
  RetryExhaustedError,
  Soda3ClientConfig,
  Soda3HttpLive,
  socrataApiVersion,
  socrataDateWindow,
  socrataMonthWindow,
  socrataTimestamp,
  soda3FetchLayer,
  soda3Layer,
  soqlAnd,
  soqlEq,
  soqlIdentifier,
  soqlIn,
  soqlIsNotNull,
  soqlLimit,
  soqlMonthWindow,
  soqlOrderBy,
  soqlParameter,
  soqlParameterName,
  soqlSelectAll,
  soqlTimestampRange,
  soqlYearMonthRange,
  TimeoutError
} from "../src/index"

const requestFixture = {
  domain: "data.cityofnewyork.us",
  datasetId: "abcd-1234",
  query: "SELECT *",
  page: {
    pageNumber: 1,
    pageSize: 10
  }
} satisfies Soda3QueryRequestInput

const exportFixture = {
  domain: "data.cityofnewyork.us",
  datasetId: "abcd-1234",
  format: "csv",
  query: "SELECT *",
  range: {
    start: 0,
    end: 99
  }
} satisfies Soda3ExportRequestInput

const catalogFixture = {
  domain: "data.cityofnewyork.us",
  query: "transit",
  ids: ["abcd-1234"],
  categories: ["Transportation"],
  tags: ["synthetic"],
  order: "name",
  limit: 5
} satisfies Soda3CatalogSearchRequestInput

const stationColumn = "station"
const metadataDomainField = "domain"

type FetchInput = Parameters<FetchImplementation>[0]
type FetchInit = Parameters<FetchImplementation>[1]
type FetchHandler = FetchImplementation

const makeFetch = (handler: FetchHandler): FetchImplementation => handler

const requestFromFetchInput = (input: FetchInput, init?: FetchInit) =>
  input instanceof Request ? input : new Request(input.toString(), init)

const fetchLayer = (handler: FetchHandler) => soda3FetchLayer(handler)

const runWithLayer = <A, E>(
  effect: Effect.Effect<A, E, HttpClient.HttpClient | Soda3ClientConfig>
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, Soda3HttpLive)))
  )

const failureOf = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.match({
        onFailure: (failure) => failure,
        onSuccess: () => undefined
      })
    )
  )

describe("@nyc-transit-kit/soda3", () => {
  test("declares the SODA3 client package surface", () => {
    expect(packageName).toBe("@nyc-transit-kit/soda3")
    expect(socrataApiVersion).toBe("v3")
    expect(defaultSocrataProtocol).toBe("https")
  })

  test("exposes public operation subpaths", async () => {
    const queryModule = await import("../src/query")
    const exportModule = await import("../src/export")
    const catalogModule = await import("../src/catalog")
    const metadataModule = await import("../src/metadata")

    expect(queryModule.queryRows).toBe(queryRows)
    expect(queryModule.queryAllRows).toBe(queryAllRows)
    expect(queryModule.countRows).toBe(countRows)
    expect(exportModule.exportResponse).toBe(exportResponse)
    expect(catalogModule.catalogSearch).toBe(catalogSearch)
    expect(catalogModule.buildCatalogSearchUrl).toBe(buildCatalogSearchUrl)
    expect(metadataModule.fetchDatasetMetadata).toBe(fetchDatasetMetadata)
  })

  test("builds SODA3 query, export, and catalog URLs", async () => {
    const queryUrl = await Effect.runPromise(buildQueryUrl(requestFixture))
    const exportUrl = await Effect.runPromise(buildExportUrl(exportFixture))
    const catalogUrl = await Effect.runPromise(buildCatalogSearchUrl(catalogFixture))

    expect(queryUrl.toString()).toBe(
      "https://data.cityofnewyork.us/api/v3/views/abcd-1234/query.json"
    )
    expect(exportUrl.toString()).toBe(
      "https://data.cityofnewyork.us/api/v3/views/abcd-1234/export.csv"
    )
    expect(catalogUrl.hostname).toBe("api.us.socrata.com")
    expect(catalogUrl.searchParams.get("domains")).toBe("data.cityofnewyork.us")
    expect(catalogUrl.searchParams.get("search_context")).toBe("data.cityofnewyork.us")
    expect(catalogUrl.searchParams.get("only")).toBe("dataset")
    expect(catalogUrl.searchParams.getAll("ids")).toEqual(["abcd-1234"])
    expect(catalogUrl.searchParams.getAll("categories")).toEqual(["Transportation"])
    expect(catalogUrl.searchParams.getAll("tags")).toEqual(["synthetic"])
    expect(catalogUrl.searchParams.get("order")).toBe("name")
    expect(queryUrl.toString()).not.toContain("/resource/")
    expect(exportUrl.toString()).not.toContain("/resource/")
  })

  test("returns typed invalid input errors for bad endpoints", async () => {
    const error = await failureOf(
      buildQueryUrl({
        domain: "https://data.cityofnewyork.us",
        datasetId: "bad",
        query: "SELECT *"
      })
    )

    expect(error).toBeInstanceOf(InvalidInputError)
  })

  test("builds small SoQL helpers", async () => {
    expect(soqlSelectAll).toBe("SELECT *")
    expect(await Effect.runPromise(soqlLimit("SELECT name", 5))).toBe("SELECT name LIMIT 5")
    expect(await Effect.runPromise(soqlIdentifier("route_id"))).toBe("route_id")
    expect(await Effect.runPromise(soqlParameterName("route"))).toBe("route")

    const parameter = await Effect.runPromise(soqlParameter("route", "M15"))
    expect(parameter).toEqual({
      text: ":route",
      parameters: {
        route: "M15"
      }
    })

    const route = await Effect.runPromise(soqlEq("route_id", "route", "M15"))
    expect(route).toEqual({
      text: "route_id = :route",
      parameters: {
        route: "M15"
      }
    })

    const routeSet = await Effect.runPromise(soqlIn("route_id", "route", ["M15", "M20"]))
    expect(routeSet).toEqual({
      text: "route_id IN (:route_1, :route_2)",
      parameters: {
        route_1: "M15",
        route_2: "M20"
      }
    })

    const composed = await Effect.runPromise(
      soqlAnd([route, await Effect.runPromise(soqlIsNotNull("trip_id"))])
    )
    expect(composed).toEqual({
      text: "(route_id = :route) AND (trip_id IS NOT NULL)",
      parameters: {
        route: "M15"
      }
    })

    expect(await Effect.runPromise(soqlOrderBy("route_id", "DESC"))).toEqual({
      text: "ORDER BY route_id DESC"
    })
  })

  test("returns typed invalid input errors for unsafe SoQL helper inputs", async () => {
    const invalidIdentifier = await failureOf(soqlIdentifier("route-id"))
    const invalidInPredicate = await failureOf(soqlIn("route_id", "route", []))
    const route = await Effect.runPromise(soqlEq("route_id", "route", "M15"))
    const duplicateParameters = await failureOf(soqlAnd([route, route]))

    expect(invalidIdentifier).toBeInstanceOf(InvalidInputError)
    expect(invalidInPredicate).toBeInstanceOf(InvalidInputError)
    expect(duplicateParameters).toBeInstanceOf(InvalidInputError)
  })

  test("builds Socrata timestamp and date-window fragments", async () => {
    expect(await Effect.runPromise(socrataTimestamp("2026-06-16"))).toBe("2026-06-16T00:00:00")
    expect(await Effect.runPromise(socrataTimestamp(new Date("2026-06-16T13:45:00Z")))).toBe(
      "2026-06-16T00:00:00"
    )
    expect(await Effect.runPromise(socrataMonthWindow(2026, 12))).toEqual({
      start: "2026-12-01T00:00:00",
      end: "2027-01-01T00:00:00"
    })
    expect(await Effect.runPromise(socrataDateWindow("2026-06-01", "2026-07-01"))).toEqual({
      start: "2026-06-01T00:00:00",
      end: "2026-07-01T00:00:00"
    })

    expect(
      await Effect.runPromise(
        soqlTimestampRange("captured_at", "window_start", "window_end", {
          start: "2026-06-01T00:00:00",
          end: "2026-07-01T00:00:00"
        })
      )
    ).toEqual({
      text: "captured_at >= :window_start AND captured_at < :window_end",
      parameters: {
        window_start: "2026-06-01T00:00:00",
        window_end: "2026-07-01T00:00:00"
      }
    })

    expect(await Effect.runPromise(soqlMonthWindow("captured_at", 2026, 6, "month"))).toEqual({
      text: "captured_at >= :month_start AND captured_at < :month_end",
      parameters: {
        month_start: "2026-06-01T00:00:00",
        month_end: "2026-07-01T00:00:00"
      }
    })

    expect(
      await Effect.runPromise(
        soqlYearMonthRange("year", "month", { year: 2025, month: 11 }, { year: 2026, month: 2 })
      )
    ).toEqual({
      text: "(year > :start_year OR (year = :start_year AND month >= :start_month)) AND (year < :end_year OR (year = :end_year AND month <= :end_month))",
      parameters: {
        start_year: 2025,
        start_month: 11,
        end_year: 2026,
        end_month: 2
      }
    })
  })

  test("returns typed invalid input errors for bad Socrata date windows", async () => {
    const invalidDate = await failureOf(socrataTimestamp("2026-02-30"))
    const reversedDateWindow = await failureOf(socrataDateWindow("2026-07-01", "2026-06-01"))
    const invalidMonth = await failureOf(socrataMonthWindow(2026, 13))

    expect(invalidDate).toBeInstanceOf(InvalidInputError)
    expect(reversedDateWindow).toBeInstanceOf(InvalidInputError)
    expect(invalidMonth).toBeInstanceOf(InvalidInputError)
  })

  test("sends query body and explicit app token header through injected fetch", async () => {
    const requests: Array<Request> = []
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return new Response(
        JSON.stringify({
          rows: [
            {
              station: "Canal St"
            }
          ],
          rowCount: 1
        }),
        {
          status: 200
        }
      )
    })
    const ConfigLayer = Layer.succeed(Soda3ClientConfig)({
      appToken: "secret-token",
      retryTimes: 0
    })

    const result = await Effect.runPromise(
      queryRows(requestFixture).pipe(Effect.provide(Layer.mergeAll(ConfigLayer, FetchLayer)))
    )

    expect(result.rowCount).toBe(1)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe("POST")
    expect(requests[0]?.headers.get("X-App-Token")).toBe("secret-token")
    expect(await requests[0]?.json()).toEqual({
      query: "SELECT *",
      page: {
        pageNumber: 1,
        pageSize: 10
      }
    })
  })

  test("provides SODA3 programs with the public layer factory", async () => {
    const requests: Array<Request> = []
    const result = await Effect.runPromise(
      queryRows(requestFixture).pipe(
        Effect.provide(
          soda3Layer({
            appToken: "secret-token",
            retryTimes: 0,
            fetch: makeFetch(async (input, init) => {
              const request = requestFromFetchInput(input, init)
              requests.push(request)
              return Response.json({
                rows: [
                  {
                    station: "Canal St"
                  }
                ]
              })
            })
          })
        )
      )
    )

    expect(result.rows).toHaveLength(1)
    expect(requests[0]?.headers.get("X-App-Token")).toBe("secret-token")
  })

  test("uses custom fetch from the public layer factory", async () => {
    const requests: Array<Request> = []

    await Effect.runPromise(
      queryRows(requestFixture).pipe(
        Effect.provide(
          soda3Layer({
            fetch: makeFetch(async (input, init) => {
              const request = requestFromFetchInput(input, init)
              requests.push(request)
              return Response.json({
                rows: []
              })
            })
          })
        )
      )
    )

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe("https://data.cityofnewyork.us/api/v3/views/abcd-1234/query.json")
  })

  test("applies timeout config from the public layer factory", async () => {
    const error = await failureOf(
      queryRows(requestFixture).pipe(
        Effect.provide(
          soda3Layer({
            timeoutMs: 1,
            fetch: makeFetch(() => new Promise<Response>(() => {}))
          })
        )
      )
    )

    expect(error).toBeInstanceOf(TimeoutError)
  })

  test("forwards SODA3 query parameters through the request body", async () => {
    const requests: Array<Request> = []
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return Response.json({
        rows: []
      })
    })

    await Effect.runPromise(
      queryRows({
        ...requestFixture,
        query: "SELECT * WHERE route_id = :route",
        parameters: {
          route: "M15"
        }
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(await requests[0]?.json()).toEqual({
      query: "SELECT * WHERE route_id = :route",
      parameters: {
        route: "M15"
      },
      page: {
        pageNumber: 1,
        pageSize: 10
      }
    })
  })

  test("paginates SODA3 query rows until the final short page", async () => {
    const requests: Array<Request> = []
    const pages = [
      {
        rows: [
          {
            station: "Canal St"
          },
          {
            station: "Spring St"
          }
        ]
      },
      {
        rows: [
          {
            station: "Prince St"
          }
        ]
      }
    ]
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return Response.json(pages.at(requests.length - 1) ?? { rows: [] })
    })

    const rows = await Effect.runPromise(
      queryAllRows({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234",
        query: "SELECT station ORDER BY station",
        pageSize: 2
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(rows.map((row) => row[stationColumn])).toEqual(["Canal St", "Spring St", "Prince St"])
    expect(requests).toHaveLength(2)
    expect(await requests[0]?.clone().json()).toEqual({
      query: "SELECT station ORDER BY station",
      page: {
        pageNumber: 1,
        pageSize: 2
      }
    })
    expect(await requests[1]?.clone().json()).toEqual({
      query: "SELECT station ORDER BY station",
      page: {
        pageNumber: 2,
        pageSize: 2
      }
    })
  })

  test("stops SODA3 auto-pagination after a short first page", async () => {
    const requests: Array<Request> = []
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return Response.json({
        rows: [
          {
            station: "Canal St"
          }
        ]
      })
    })

    const rows = await Effect.runPromise(
      queryAllRows({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234",
        query: "SELECT station",
        pageSize: 5
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(rows).toHaveLength(1)
    expect(requests).toHaveLength(1)
  })

  test("rejects SODA3 auto-pagination when maxRows is exceeded", async () => {
    const FetchLayer = fetchLayer(async () =>
      Response.json({
        rows: [
          {
            station: "Canal St"
          },
          {
            station: "Spring St"
          }
        ]
      })
    )

    const error = await failureOf(
      queryAllRows({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234",
        query: "SELECT station",
        pageSize: 2,
        maxRows: 1
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(error).toBeInstanceOf(InvalidInputError)
  })

  test("validates SODA3 auto-pagination helper options before fetching", async () => {
    let calls = 0
    const FetchLayer = fetchLayer(async () => {
      calls += 1
      return Response.json({
        rows: []
      })
    })

    const error = await failureOf(
      queryAllRows({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234",
        query: "SELECT station",
        pageSize: 0
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(error).toBeInstanceOf(InvalidInputError)
    expect(calls).toBe(0)
  })

  test("counts SODA3 rows with a SoQL count query", async () => {
    const requests: Array<Request> = []
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return Response.json({
        rows: [
          {
            count: "42"
          }
        ]
      })
    })

    const count = await Effect.runPromise(
      countRows({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234",
        where: "borough = :borough",
        parameters: {
          borough: "Manhattan"
        }
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(count).toBe(42)
    expect(await requests[0]?.clone().json()).toEqual({
      query: "SELECT count(*) WHERE borough = :borough",
      parameters: {
        borough: "Manhattan"
      },
      includeSynthetic: false
    })
  })

  test("rejects malformed SODA3 count responses", async () => {
    const FetchLayer = fetchLayer(async () =>
      Response.json({
        rows: [
          {
            count: "not-a-number"
          }
        ]
      })
    )

    const error = await failureOf(
      countRows({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234"
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(error).toBeInstanceOf(ProviderContractError)
  })

  test("does not send an app token header when none is configured", async () => {
    const requests: Array<Request> = []
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return new Response(
        JSON.stringify({
          rows: []
        }),
        {
          status: 200
        }
      )
    })

    await Effect.runPromise(
      queryRows(requestFixture).pipe(
        Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer))
      )
    )

    expect(requests[0]?.headers.has("X-App-Token")).toBe(false)
  })

  test("returns typed provider errors without leaking app tokens", async () => {
    const FetchLayer = fetchLayer(
      async () =>
        new Response("upstream failed", {
          status: 500,
          statusText: "Server Error"
        })
    )
    const ConfigLayer = Layer.succeed(Soda3ClientConfig)({
      appToken: "secret-token",
      retryTimes: 0
    })

    const error = await failureOf(
      queryRows(requestFixture).pipe(Effect.provide(Layer.mergeAll(ConfigLayer, FetchLayer)))
    )

    expect(error).toBeInstanceOf(ProviderHttpError)
    expect(JSON.stringify(error)).not.toContain("secret-token")
  })

  test("retries transient provider failures before succeeding", async () => {
    let attempts = 0
    const FetchLayer = fetchLayer(async () => {
      attempts += 1
      if (attempts === 1) {
        return new Response("temporary", {
          status: 503,
          statusText: "Unavailable"
        })
      }

      return new Response(
        JSON.stringify({
          rows: [
            {
              station: "Canal St"
            }
          ]
        }),
        {
          status: 200
        }
      )
    })
    const ConfigLayer = Layer.succeed(Soda3ClientConfig)({
      retryTimes: 1
    })

    const result = await Effect.runPromise(
      queryRows(requestFixture).pipe(Effect.provide(Layer.mergeAll(ConfigLayer, FetchLayer)))
    )

    expect(attempts).toBe(2)
    expect(result.rows).toHaveLength(1)
  })

  test("backs off between delayed SODA3 retry attempts", async () => {
    const attemptTimes: Array<number> = []
    const FetchLayer = fetchLayer(async () => {
      attemptTimes.push(performance.now())
      if (attemptTimes.length < 3) {
        return new Response("temporary", {
          status: 503,
          statusText: "Unavailable"
        })
      }

      return Response.json({
        rows: [
          {
            station: "Canal St"
          }
        ]
      })
    })
    const ConfigLayer = Layer.succeed(Soda3ClientConfig)({
      retryTimes: 2,
      retryDelayMs: 10
    })

    const result = await Effect.runPromise(
      queryRows(requestFixture).pipe(Effect.provide(Layer.mergeAll(ConfigLayer, FetchLayer)))
    )

    expect(result.rows).toHaveLength(1)
    expect(attemptTimes).toHaveLength(3)
    expect((attemptTimes[1] ?? 0) - (attemptTimes[0] ?? 0)).toBeGreaterThanOrEqual(8)
    expect((attemptTimes[2] ?? 0) - (attemptTimes[1] ?? 0)).toBeGreaterThanOrEqual(18)
  })

  test("preserves immediate SODA3 retries when retryDelayMs is zero", async () => {
    let attempts = 0
    const FetchLayer = fetchLayer(async () => {
      attempts += 1
      return attempts === 1
        ? new Response("temporary", {
            status: 503,
            statusText: "Unavailable"
          })
        : Response.json({
            rows: []
          })
    })
    const ConfigLayer = Layer.succeed(Soda3ClientConfig)({
      retryTimes: 1,
      retryDelayMs: 0
    })

    const result = await Effect.runPromise(
      queryRows(requestFixture).pipe(Effect.provide(Layer.mergeAll(ConfigLayer, FetchLayer)))
    )

    expect(attempts).toBe(2)
    expect(result.rows).toHaveLength(0)
  })

  test("returns retry exhaustion when transient provider failures continue", async () => {
    const FetchLayer = fetchLayer(
      async () =>
        new Response("temporary", {
          status: 503,
          statusText: "Unavailable"
        })
    )
    const ConfigLayer = Layer.succeed(Soda3ClientConfig)({
      retryTimes: 1
    })

    const error = await failureOf(
      queryRows(requestFixture).pipe(Effect.provide(Layer.mergeAll(ConfigLayer, FetchLayer)))
    )

    expect(error).toBeInstanceOf(RetryExhaustedError)
  })

  test("forwards range headers for export probes and keeps the raw response available", async () => {
    const requests: Array<Request> = []
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return new Response("station,line\nCanal St,A\n", {
        status: 206
      })
    })

    const response = await Effect.runPromise(
      exportResponse(exportFixture).pipe(
        Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer))
      )
    )

    expect(response.status).toBe(206)
    expect(requests[0]?.headers.get("range")).toBe("bytes=0-99")
    expect(await response.text()).toContain("Canal St")
  })

  test("forwards open-ended SODA3 export range headers", async () => {
    const requests: Array<Request> = []
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return new Response("station\nCanal St\n", {
        status: 206
      })
    })

    await Effect.runPromise(
      exportResponse({
        ...exportFixture,
        range: {
          start: 100
        }
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(requests[0]?.headers.get("range")).toBe("bytes=100-")
  })

  test("rejects inverted SODA3 export ranges before fetching", async () => {
    let calls = 0
    const FetchLayer = fetchLayer(async () => {
      calls += 1
      return new Response("")
    })

    const error = await failureOf(
      exportResponse({
        ...exportFixture,
        range: {
          start: 100,
          end: 50
        }
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(error).toBeInstanceOf(InvalidInputError)
    expect(calls).toBe(0)
  })

  test("decodes catalog search responses", async () => {
    const FetchLayer = fetchLayer(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                resource: {
                  id: "abcd-1234",
                  name: "Synthetic Transit Stations",
                  type: "dataset",
                  description: "Small synthetic fixture for client tests.",
                  columns_name: ["Station"],
                  columns_field_name: ["station"]
                },
                classification: {
                  categories: ["Transportation"],
                  domain_metadata: [
                    {
                      key: "Update_Update-Frequency",
                      value: "Monthly"
                    }
                  ]
                },
                metadata: {
                  domain: "data.cityofnewyork.us"
                },
                permalink: "https://data.cityofnewyork.us/d/abcd-1234"
              }
            ],
            resultSetSize: 1,
            warnings: [],
            timings: {
              search: 1
            }
          }),
          {
            status: 200
          }
        )
    )

    const result = await Effect.runPromise(
      catalogSearch(catalogFixture).pipe(
        Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer))
      )
    )

    expect(result.resultSetSize).toBe(1)
    expect(String(result.results[0]?.resource.id)).toBe("abcd-1234")
    expect(result.results[0]?.resource.columns_field_name).toEqual(["station"])
    expect(result.results[0]?.metadata?.[metadataDomainField]).toBe("data.cityofnewyork.us")
    expect(result.results[0]?.classification?.domain_metadata?.[0]?.key).toBe(
      "Update_Update-Frequency"
    )
  })

  test("fetches exact Discovery-backed dataset metadata", async () => {
    const requests: Array<Request> = []
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return Response.json({
        results: [
          {
            resource: {
              id: "ycrg-ses3",
              name: "Bus Lanes - Local Streets",
              type: "dataset",
              columns_name: ["Street"],
              columns_field_name: ["street"],
              columns_datatype: ["text"]
            },
            metadata: {
              domain: "data.cityofnewyork.us"
            },
            permalink: "https://data.cityofnewyork.us/d/ycrg-ses3"
          }
        ],
        resultSetSize: 1
      })
    })

    const result = await Effect.runPromise(
      fetchDatasetMetadata({
        domain: "data.cityofnewyork.us",
        datasetId: "ycrg-ses3"
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )
    const url = new URL(requests[0]?.url ?? "https://example.test")

    expect(url.hostname).toBe("api.us.socrata.com")
    expect(url.searchParams.get("domains")).toBe("data.cityofnewyork.us")
    expect(url.searchParams.get("search_context")).toBe("data.cityofnewyork.us")
    expect(url.searchParams.get("only")).toBe("dataset")
    expect(url.searchParams.get("limit")).toBe("1")
    expect(url.searchParams.getAll("ids")).toEqual(["ycrg-ses3"])
    expect(String(result.resource.id)).toBe("ycrg-ses3")
    expect(result.resource.columns_name).toEqual(["Street"])
    expect(result.resource.columns_field_name).toEqual(["street"])
  })

  test("forwards app tokens for Discovery-backed metadata", async () => {
    const requests: Array<Request> = []
    const FetchLayer = fetchLayer(async (input, init) => {
      const request = requestFromFetchInput(input, init)
      requests.push(request)
      return Response.json({
        results: [
          {
            resource: {
              id: "ycrg-ses3",
              name: "Bus Lanes - Local Streets"
            }
          }
        ]
      })
    })
    const ConfigLayer = Layer.succeed(Soda3ClientConfig)({
      appToken: "secret-token",
      retryTimes: 0
    })

    await Effect.runPromise(
      fetchDatasetMetadata({
        domain: "data.cityofnewyork.us",
        datasetId: "ycrg-ses3"
      }).pipe(Effect.provide(Layer.mergeAll(ConfigLayer, FetchLayer)))
    )

    expect(requests[0]?.headers.get("X-App-Token")).toBe("secret-token")
  })

  test("validates metadata inputs before fetching", async () => {
    let calls = 0
    const FetchLayer = fetchLayer(async () => {
      calls += 1
      return Response.json({
        results: []
      })
    })

    const error = await failureOf(
      fetchDatasetMetadata({
        domain: "data.cityofnewyork.us",
        datasetId: "not-a-dataset-id"
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(error).toBeInstanceOf(InvalidInputError)
    expect(calls).toBe(0)
  })

  test("rejects empty Discovery metadata responses", async () => {
    const FetchLayer = fetchLayer(async () =>
      Response.json({
        results: [],
        resultSetSize: 0
      })
    )

    const error = await failureOf(
      fetchDatasetMetadata({
        domain: "data.cityofnewyork.us",
        datasetId: "ycrg-ses3"
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(error).toBeInstanceOf(ProviderContractError)
  })

  test("rejects non-matching Discovery metadata responses", async () => {
    const FetchLayer = fetchLayer(async () =>
      Response.json({
        results: [
          {
            resource: {
              id: "abcd-1234",
              name: "Different Dataset"
            }
          }
        ],
        resultSetSize: 1
      })
    )

    const error = await failureOf(
      fetchDatasetMetadata({
        domain: "data.cityofnewyork.us",
        datasetId: "ycrg-ses3"
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(error).toBeInstanceOf(ProviderContractError)
  })

  test("tolerates extra catalog search response fields", async () => {
    const FetchLayer = fetchLayer(async () =>
      Response.json({
        results: [
          {
            resource: {
              id: "abcd-1234",
              name: "Synthetic Transit Stations",
              owner: {
                display_name: "Example"
              }
            },
            metadata: {
              domain: "data.cityofnewyork.us"
            },
            timings: {
              search: 1
            }
          }
        ],
        resultSetSize: 1,
        warnings: [],
        timings: {
          total: 1
        }
      })
    )

    const result = await Effect.runPromise(
      catalogSearch(catalogFixture).pipe(
        Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer))
      )
    )

    expect(result.results).toHaveLength(1)
  })

  test("returns typed invalid input errors for non JSON serializable bodies", async () => {
    const FetchLayer = fetchLayer(async () => new Response("not used", { status: 200 }))

    const error = await failureOf(
      queryRows({
        ...requestFixture,
        parameters: {
          count: 1n
        }
      }).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, FetchLayer)))
    )

    expect(error).toBeInstanceOf(InvalidInputError)
    expect(error).toMatchObject({
      operation: "query",
      message: "SODA3 query body was not JSON serializable"
    })
  })

  test("can run with the package live layer type", async () => {
    const queryUrl = await runWithLayer(buildQueryUrl(requestFixture))
    expect(queryUrl.pathname).toBe("/api/v3/views/abcd-1234/query.json")
  })
})
