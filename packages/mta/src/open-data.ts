import { queryRows } from "@nyc-transit-kit/soda3/client"
import { mtaOpenDataDomain } from "./datasets"

export const queryMtaOpenData = (input: {
  readonly datasetId: string
  readonly query: string
  readonly page?: {
    readonly pageNumber: number
    readonly pageSize: number
  }
}) =>
  input.page === undefined
    ? queryRows({
        domain: mtaOpenDataDomain,
        datasetId: input.datasetId,
        query: input.query
      })
    : queryRows({
        domain: mtaOpenDataDomain,
        datasetId: input.datasetId,
        query: input.query,
        page: input.page
      })
