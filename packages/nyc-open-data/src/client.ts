import { catalogSearch } from "@nyc-transit-kit/soda3/catalog"
import { exportResponse } from "@nyc-transit-kit/soda3/export"
import { queryRows } from "@nyc-transit-kit/soda3/query"
import { defaultDomain } from "./descriptors"

export const queryNycOpenDataDataset = (input: {
  readonly datasetId: string
  readonly query: string
  readonly page?: {
    readonly pageNumber: number
    readonly pageSize: number
  }
}) =>
  queryRows({
    domain: defaultDomain,
    datasetId: input.datasetId,
    query: input.query,
    ...(input.page === undefined ? {} : { page: input.page })
  })

export const exportNycOpenDataDataset = (input: {
  readonly datasetId: string
  readonly format: "csv" | "json" | "geojson"
  readonly query?: string
  readonly range?: {
    readonly start: number
    readonly end: number
  }
}) =>
  exportResponse({
    domain: defaultDomain,
    datasetId: input.datasetId,
    format: input.format,
    ...(input.query === undefined ? {} : { query: input.query }),
    ...(input.range === undefined ? {} : { range: input.range })
  })

export const searchNycOpenDataCatalog = (input: {
  readonly query?: string
  readonly limit?: number
  readonly offset?: number
}) =>
  catalogSearch({
    domain: defaultDomain,
    ...(input.query === undefined ? {} : { query: input.query }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    ...(input.offset === undefined ? {} : { offset: input.offset })
  })
