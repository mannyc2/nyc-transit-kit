import { describe, expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Stream from "effect/Stream"
import { type DatasetRef, SocrataDatasetId, SocrataDomain } from "../src/Socrata"
import * as Soda3Client from "../src/Soda3Client"
import * as Soql from "../src/Soql"

const ref: DatasetRef = {
  domain: SocrataDomain.make("data.cityofnewyork.us"),
  datasetId: SocrataDatasetId.make("i4gi-tjb9")
}
const queryUrl = "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9/query.json"

/** The real client, with a token, against a SODA3 fake that answers with `handler`. */
const soda3 = (handler: HttpTest.Handler) =>
  Soda3Client.layer({ appToken: Redacted.make("test-token") }).pipe(
    Layer.provideMerge(HttpTest.soda3(handler))
  )

const query = (request: Omit<Soda3Client.QueryRequest, "domain" | "datasetId">) =>
  Soda3Client.Soda3Client.use((soda) => soda.query({ ...ref, ...request }))

describe("query", () => {
  it.effect("posts the query with the app token and returns the rows", () =>
    Effect.gen(function* () {
      const rows = yield* query({ query: "SELECT *" })
      expect(rows).toEqual(Samples.trafficSpeedRows)
      const [request] = yield* HttpTest.requests
      expect(request?.method).toBe("POST")
      expect(request?.url.href).toBe(queryUrl)
      expect(request?.headers["x-app-token"]).toBe("test-token")
      expect(request?.headers.accept).toBe("application/json")
      expect(request?.body).toEqual({ query: "SELECT *" })
    }).pipe(Effect.provide(soda3(() => Response.json(Samples.trafficSpeedRows))))
  )

  it.effect("sends a fragment as SoQL text with its values written in", () =>
    Effect.gen(function* () {
      yield* query({ query: Soql.selectAll({ where: Soql.eq("borough", "Queens"), limit: 1 }) })
      const [request] = yield* HttpTest.requests
      // SODA3 has no bind parameters: `:borough` would name a system column.
      expect(request?.body).toEqual({ query: "SELECT * WHERE `borough` = 'Queens' LIMIT 1" })
    }).pipe(Effect.provide(soda3(() => Response.json([]))))
  )

  it.effect("sends only body fields, whatever else the request carries", () =>
    Effect.gen(function* () {
      const curated = { ...ref, title: "DOT Traffic Speeds", row: "not a body field" }
      yield* Soda3Client.Soda3Client.use((soda) =>
        soda.query({ ...curated, query: "SELECT *", includeSynthetic: false })
      )
      const [request] = yield* HttpTest.requests
      expect(request?.body).toEqual({ query: "SELECT *", includeSynthetic: false })
    }).pipe(Effect.provide(soda3(() => Response.json([]))))
  )

  it.effect("a query that cannot be written is refused before anything is sent", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(query({ query: Soql.eq("bad`name", 1) }))
      expect(error._tag).toBe("SoqlError")
      expect(yield* HttpTest.requests).toEqual([])
    }).pipe(Effect.provide(soda3(() => Response.json([]))))
  )

  it.effect("a refusal carries Socrata's own sentence", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(query({ query: "SELECT *" }))
      expect(error).toMatchObject({
        _tag: "SocrataError",
        status: 403,
        code: Samples.soda3AuthenticationRequired.code,
        message: Samples.soda3AuthenticationRequired.message
      })
    }).pipe(
      Effect.provide(
        soda3(() => Response.json(Samples.soda3AuthenticationRequired, { status: 403 }))
      )
    )
  )

  it.effect("a query SODA3 cannot run fails with its code and sentence", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(query({ query: "SELECT * WHERE `no_such_column` = 'x'" }))
      expect(error).toMatchObject({
        _tag: "SocrataError",
        status: 400,
        code: Samples.soda3NoSuchColumn.code,
        message: Samples.soda3NoSuchColumn.message
      })
    }).pipe(Effect.provide(soda3(() => Response.json(Samples.soda3NoSuchColumn, { status: 400 }))))
  )

  it.effect("a refusal without a body still says what happened", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(query({ query: "SELECT *" }))
      expect(error).toMatchObject({ _tag: "SocrataError", message: "Socrata answered HTTP 502" })
    }).pipe(Effect.provide(soda3(() => new Response(null, { status: 502 }))))
  )

  it.effect("a body that is not rows fails to decode", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(query({ query: "SELECT *" }))
      expect(error._tag).toBe("SchemaError")
    }).pipe(Effect.provide(soda3(() => Response.json(Samples.catalogSearchResponse))))
  )
})

describe("streamRows", () => {
  const pageSize = Samples.trafficSpeedRows.length
  // Two full pages, then an empty one.
  const pageOf = (request: HttpTest.SentRequest) => {
    const { page } = request.body as { readonly page: { readonly pageNumber: number } }
    return page.pageNumber < 3 ? Samples.trafficSpeedRows : []
  }

  it.effect("requests pages until a short one", () =>
    Effect.gen(function* () {
      const rows = yield* Stream.runCollect(
        Soda3Client.streamRows({ ...ref, query: "SELECT *" }, pageSize)
      )
      expect(rows).toEqual([...Samples.trafficSpeedRows, ...Samples.trafficSpeedRows])
      const bodies = (yield* HttpTest.requests).map((request) => request.body)
      expect(bodies).toEqual(
        [1, 2, 3].map((pageNumber) => ({ query: "SELECT *", page: { pageNumber, pageSize } }))
      )
    }).pipe(Effect.provide(soda3((request) => Response.json(pageOf(request)))))
  )

  it.effect("stops after one request when the first page is short", () =>
    Effect.gen(function* () {
      const rows = yield* Stream.runCollect(
        Soda3Client.streamRows({ ...ref, query: "SELECT *" }, pageSize + 1)
      )
      expect(rows).toEqual(Samples.trafficSpeedRows)
      expect(yield* HttpTest.requests).toHaveLength(1)
    }).pipe(Effect.provide(soda3(() => Response.json(Samples.trafficSpeedRows))))
  )
})

describe("countRows", () => {
  it.effect("counts the rows a fragment matches", () =>
    Effect.gen(function* () {
      expect(yield* Soda3Client.countRows(ref, Soql.eq("borough", "Queens"))).toBe(33539349)
      const [request] = yield* HttpTest.requests
      expect(request?.body).toEqual({
        query: "SELECT count(*) AS count WHERE `borough` = 'Queens'",
        includeSynthetic: false
      })
    }).pipe(Effect.provide(soda3(() => Response.json(Samples.trafficSpeedQueensCount))))
  )

  it.effect("counts every row without a fragment", () =>
    Effect.gen(function* () {
      expect(yield* Soda3Client.countRows(ref)).toBe(113269686)
      const [request] = yield* HttpTest.requests
      expect(request?.body).toEqual({ query: "SELECT count(*) AS count", includeSynthetic: false })
    }).pipe(Effect.provide(soda3(() => Response.json(Samples.trafficSpeedCount))))
  )
})

describe("export", () => {
  const exported = (request: Omit<Soda3Client.ExportRequest, "domain" | "datasetId"> = {}) =>
    Stream.unwrap(
      Effect.map(Soda3Client.Soda3Client, (soda) => soda.export({ ...ref, ...request }))
    ).pipe(Stream.decodeText(), Stream.mkString)

  // SODA3 ignores Range and sends the whole file, as this fake does.
  const csv = () =>
    new Response(Samples.trafficSpeedCsv, { headers: { "content-type": "text/csv" } })

  it.effect("streams the CSV and sends a Range header only when asked", () =>
    Effect.gen(function* () {
      expect(yield* exported()).toBe(Samples.trafficSpeedCsv)
      yield* exported({
        range: { start: 0, end: 9 },
        query: Soql.selectAll({ limit: 1 }),
        // The serialization options SODA3's documentation shows.
        serializationOptions: { separator: "\t", bom: true }
      })
      yield* exported({ range: { start: 10 } })
      const [whole, ranged, open] = yield* HttpTest.requests
      expect(whole?.url.href).toBe(
        "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9/export.csv"
      )
      expect(whole?.headers.range).toBeUndefined()
      expect(whole?.body).toEqual({})
      expect(ranged?.headers.range).toBe("bytes=0-9")
      expect(ranged?.body).toEqual({
        query: "SELECT * LIMIT 1",
        serializationOptions: { separator: "\t", bom: true }
      })
      expect(open?.url.pathname).toBe("/api/v3/views/i4gi-tjb9/export.csv")
      expect(open?.headers.range).toBe("bytes=10-")
    }).pipe(Effect.provide(soda3(csv)))
  )

  it.effect("a refusal fails the stream with Socrata's sentence", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(exported())
      expect(error).toMatchObject({
        _tag: "SocrataError",
        status: 403,
        code: Samples.soda3InvalidAppToken.code,
        message: Samples.soda3InvalidAppToken.message
      })
    }).pipe(
      Effect.provide(soda3(() => Response.json(Samples.soda3InvalidAppToken, { status: 403 })))
    )
  )
})
