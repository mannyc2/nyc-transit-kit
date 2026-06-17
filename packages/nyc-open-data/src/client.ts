import { exportResponse } from "@nyc-transit-kit/soda3/export"
import { defaultDomain } from "./descriptors"

export { queryNycOpenDataDataset } from "./query"

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
