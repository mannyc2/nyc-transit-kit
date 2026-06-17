import { searchNycOpenDataCatalog } from "@nyc-transit-kit/nyc-open-data/catalog"
import { queryNycOpenDataDataset } from "@nyc-transit-kit/nyc-open-data/query"
import { runSoda3Effect } from "./internal/run"
import type { Soda3CompatOptions } from "./soda3"

export const queryNycOpenDataRows = (
  input: {
    readonly datasetId: string
    readonly query: string
  },
  options?: Soda3CompatOptions
) => runSoda3Effect(queryNycOpenDataDataset(input), options)

export const searchNycOpenData = (
  input: {
    readonly query?: string
    readonly limit?: number
  },
  options?: Soda3CompatOptions
) => runSoda3Effect(searchNycOpenDataCatalog(input), options)
