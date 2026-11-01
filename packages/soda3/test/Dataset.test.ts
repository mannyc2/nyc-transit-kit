import { describe, expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"
import * as Dataset from "../src/Dataset"
import { FloatingTimestamp, SocrataDatasetId, SocrataDomain } from "../src/Socrata"
import * as Soda3Client from "../src/Soda3Client"
import * as Soql from "../src/Soql"

// Just enough of DOT Traffic Speeds to type its rows; the rest stays unknown.
const speeds = {
  domain: SocrataDomain.make("data.cityofnewyork.us"),
  datasetId: SocrataDatasetId.make("i4gi-tjb9"),
  title: "DOT Traffic Speeds",
  description: "Near-realtime speed and travel time for each TRANSCOM link.",
  row: Schema.Struct({ id: Schema.String, borough: Schema.String, data_as_of: FloatingTimestamp }),
  timestampColumn: "data_as_of"
} satisfies Dataset.Dataset

const soda3 = (handler: HttpTest.Handler) =>
  Soda3Client.layer({ appToken: Redacted.make("test-token") }).pipe(
    Layer.provideMerge(HttpTest.soda3(handler))
  )

describe("query", () => {
  it.effect("selects whole rows with the given clauses and decodes them", () =>
    Effect.gen(function* () {
      const rows = yield* Dataset.query(speeds, {
        where: Soql.eq("borough", "Staten Island"),
        orderBy: { column: "data_as_of", direction: "DESC" },
        limit: 2
      })
      expect(rows.map((row) => row.id)).toEqual(Samples.trafficSpeedRows.map((row) => row.id))
      const [request] = yield* HttpTest.requests
      expect(request?.url.pathname).toBe("/api/v3/views/i4gi-tjb9/query.json")
      // Only the query: nothing else from the curated dataset reaches the body.
      expect(request?.body).toEqual({
        query: "SELECT * WHERE `borough` = 'Staten Island' ORDER BY `data_as_of` DESC LIMIT 2"
      })
    }).pipe(Effect.provide(soda3(() => Response.json(Samples.trafficSpeedRows))))
  )

  it.effect("rows of another dataset fail to decode", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Dataset.query(speeds))
      expect(error._tag).toBe("SchemaError")
    }).pipe(Effect.provide(soda3(() => Response.json(Samples.busLaneRows))))
  )
})

describe("stream", () => {
  it.effect("pages oldest first by the timestamp column and decodes every row", () =>
    Effect.gen(function* () {
      const pageSize = Samples.trafficSpeedRows.length
      const rows = yield* Stream.runCollect(
        Dataset.stream(speeds, { where: Soql.isNotNull("speed") }, pageSize)
      )
      expect(rows).toHaveLength(pageSize * 2)
      const bodies = (yield* HttpTest.requests).map((request) => request.body)
      // Rows added while it pages sort last, so the pages already read stay put.
      expect(bodies[0]).toEqual({
        query: "SELECT * WHERE `speed` IS NOT NULL ORDER BY `data_as_of` ASC",
        page: { pageNumber: 1, pageSize }
      })
      expect(bodies).toHaveLength(3)
    }).pipe(
      Effect.provide(
        soda3((request) => {
          const { page } = request.body as { readonly page: { readonly pageNumber: number } }
          return Response.json(page.pageNumber < 3 ? Samples.trafficSpeedRows : [])
        })
      )
    )
  )

  it.effect("keeps the order it is given, and orders nothing without a timestamp column", () =>
    Effect.gen(function* () {
      yield* Stream.runDrain(
        Dataset.stream(speeds, { orderBy: { column: "id", direction: "DESC" } })
      )
      yield* Stream.runDrain(Dataset.stream(Struct.omit(speeds, ["timestampColumn"])))
      const bodies = (yield* HttpTest.requests).map((request) => request.body)
      const firstPage = { pageNumber: 1, pageSize: 1000 }
      expect(bodies).toEqual([
        { query: "SELECT * ORDER BY `id` DESC", page: firstPage },
        { query: "SELECT *", page: firstPage }
      ])
    }).pipe(Effect.provide(soda3(() => Response.json([]))))
  )
})

it.effect("exportBytes asks for the CSV export and passes the body along", () =>
  Effect.gen(function* () {
    const text = yield* Dataset.exportBytes(speeds, {
      query: Soql.selectAll({ limit: 2 })
    }).pipe(Stream.decodeText(), Stream.mkString)
    expect(text).toBe(Samples.trafficSpeedCsv)
    const [request] = yield* HttpTest.requests
    expect(request?.url.pathname).toBe("/api/v3/views/i4gi-tjb9/export.csv")
    expect(request?.body).toEqual({ query: "SELECT * LIMIT 2" })
  }).pipe(Effect.provide(soda3(() => new Response(Samples.trafficSpeedCsv))))
)
