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
  input.page === undefined
    ? queryRows({
        domain: defaultDomain,
        datasetId: input.datasetId,
        query: input.query
      })
    : queryRows({
        domain: defaultDomain,
        datasetId: input.datasetId,
        query: input.query,
        page: input.page
      })
