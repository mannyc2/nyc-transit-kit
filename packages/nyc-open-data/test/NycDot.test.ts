import { describe, expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as Dataset from "@nyc-transit-kit/soda3/Dataset"
import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as Soql from "@nyc-transit-kit/soda3/Soql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as NycDot from "../src/NycDot"
import * as NycOpenData from "../src/NycOpenData"

describe("row schemas", () => {
  it.effect("decode the real rows of their datasets", () =>
    Effect.gen(function* () {
      const speeds = yield* Schema.decodeUnknownEffect(Schema.Array(NycDot.TrafficSpeedRow))(
        Samples.trafficSpeedRows
      )
      expect(speeds[0]?.data_as_of).toBe("2026-10-26T22:48:03.000")
      const lanes = yield* Schema.decodeUnknownEffect(Schema.Array(NycDot.BusLaneRow))(
        Samples.busLaneRows
      )
      expect(lanes[0]?.the_geom.type).toBe("MultiLineString")
      const volumes = yield* Schema.decodeUnknownEffect(Schema.Array(NycDot.TrafficVolumeRow))(
        Samples.trafficVolumeRows
      )
      expect(typeof volumes[0]?.segmentid).toBe("number")
    })
  )

  it.effect("refuse another dataset's rows", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Schema.decodeUnknownEffect(Schema.Array(NycDot.TrafficSpeedRow))(Samples.busLaneRows)
      )
      expect(error._tag).toBe("SchemaError")
    })
  )
})

describe("datasets", () => {
  it("live on NYC Open Data, and each time column is a column of the row", () => {
    for (const dataset of Object.values(NycDot.datasets)) {
      expect(dataset.domain).toBe(NycOpenData.domain)
      if ("timestampColumn" in dataset) {
        expect(Object.keys(dataset.row.fields)).toContain(dataset.timestampColumn)
      }
    }
  })

  it.effect("query as typed rows", () =>
    Effect.gen(function* () {
      const rows = yield* Dataset.query(NycDot.datasets["traffic-speeds"], {
        where: Soql.eq("borough", "Staten Island"),
        orderBy: { column: "data_as_of", direction: "DESC" },
        limit: 2
      })
      expect(rows.map((row) => row.link_name)).toEqual(
        Samples.trafficSpeedRows.map((row) => row.link_name)
      )
      const [request] = yield* HttpTest.requests
      expect(request?.url.href).toBe(
        "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9/query.json"
      )
    }).pipe(
      Effect.provide(
        Soda3Client.layer({ appToken: Redacted.make("test-token") }).pipe(
          Layer.provideMerge(HttpTest.soda3(() => Response.json(Samples.trafficSpeedRows)))
        )
      )
    )
  )
})
