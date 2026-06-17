import { describe, expect, test } from "bun:test"
import type {
  Soda3CatalogSearchRequestInput,
  Soda3ExportRequestInput,
  Soda3QueryRequestInput
} from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import {
  buildCatalogSearchUrl,
  buildExportUrl,
  buildQueryUrl,
  catalogSearch,
  defaultSocrataProtocol,
  exportResponse,
  InvalidInputError,
  ProviderHttpError,
  packageName,
  queryRows,
  RetryExhaustedError,
  Soda3ClientConfig,
  Soda3HttpLive,
  socrataApiVersion,
  socrataDateWindow,
  socrataMonthWindow,
  socrataTimestamp,
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
  soqlYearMonthRange
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
  limit: 5
} satisfies Soda3CatalogSearchRequestInput

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

    expect(queryModule.queryRows).toBe(queryRows)
    expect(exportModule.exportResponse).toBe(exportResponse)
    expect(catalogModule.catalogSearch).toBe(catalogSearch)
    expect(catalogModule.buildCatalogSearchUrl).toBe(buildCatalogSearchUrl)
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
                  domain: "data.cityofnewyork.us",
                  type: "dataset"
                }
              }
            ],
            resultCount: 1
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

    expect(result.resultCount).toBe(1)
    expect(String(result.results[0]?.resource.id)).toBe("abcd-1234")
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
