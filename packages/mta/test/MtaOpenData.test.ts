import { expect, it } from "@effect/vitest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as MtaOpenData from "../src/MtaOpenData"

it.effect("catalog rows decode, published and planned alike", () =>
  Effect.gen(function* () {
    const rows = yield* Schema.decodeUnknownEffect(Schema.Array(MtaOpenData.CatalogRow))(
      Samples.mtaOpenDataCatalogRows
    )
    expect(rows).toHaveLength(Samples.mtaOpenDataCatalogRows.length)
  })
)

it("the catalog's time column is a column of real rows", () => {
  const { catalog } = MtaOpenData.datasets
  expect(Object.keys(catalog.row.fields)).toContain(catalog.timestampColumn)
  expect(Samples.mtaOpenDataCatalogRows[0]).toHaveProperty(catalog.timestampColumn)
  expect(catalog.domain).toBe(MtaOpenData.domain)
})
