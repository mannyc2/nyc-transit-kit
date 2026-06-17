import { exportResponse } from "@nyc-transit-kit/soda3/export"
import { queryRows } from "@nyc-transit-kit/soda3/query"
import * as Effect from "effect/Effect"
import { nycDotOpenDataDomain, requireNycDotDataset } from "./datasets"

export const queryNycDotDataset = (input: {
  readonly name: string
  readonly query: string
  readonly page?: {
    readonly pageNumber: number
    readonly pageSize: number
  }
}) =>
  Effect.gen(function* () {
    const dataset = yield* requireNycDotDataset(input.name)
    return yield* queryRows({
      domain: nycDotOpenDataDomain,
      datasetId: String(dataset.id),
      query: input.query,
      ...(input.page === undefined ? {} : { page: input.page })
    })
  })

export const exportNycDotDataset = (input: {
  readonly name: string
  readonly format: "csv" | "json" | "geojson"
  readonly query?: string
  readonly range?: {
    readonly start: number
    readonly end: number
  }
}) =>
  Effect.gen(function* () {
    const dataset = yield* requireNycDotDataset(input.name)
    return yield* exportResponse({
      domain: nycDotOpenDataDomain,
      datasetId: String(dataset.id),
      format: input.format,
      ...(input.query === undefined ? {} : { query: input.query }),
      ...(input.range === undefined ? {} : { range: input.range })
    })
  })
