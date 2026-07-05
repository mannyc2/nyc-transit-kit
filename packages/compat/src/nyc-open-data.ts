import {
  exportNycOpenDataDataset,
  queryNycOpenDataDataset,
  searchNycOpenDataCatalog
} from "@nyc-transit-kit/nyc-open-data/client"
import { runSoda3Effect } from "./internal/runtime"
import type { Soda3CompatOptions } from "./soda3"

type NycOpenDataQueryInput = Parameters<typeof queryNycOpenDataDataset>[0]
type NycOpenDataExportInput = Parameters<typeof exportNycOpenDataDataset>[0]
type NycOpenDataSearchInput = Parameters<typeof searchNycOpenDataCatalog>[0]
export const queryNycOpenDataRows = (input: NycOpenDataQueryInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(queryNycOpenDataDataset(input), options)
export const exportNycOpenDataResponse = (
  input: NycOpenDataExportInput,
  options?: Soda3CompatOptions
) => runSoda3Effect(exportNycOpenDataDataset(input), options)
export const searchNycOpenData = (input: NycOpenDataSearchInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(searchNycOpenDataCatalog(input), options)
