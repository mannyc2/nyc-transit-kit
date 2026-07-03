import { searchNycOpenDataCatalog } from "@nyc-transit-kit/nyc-open-data/catalog"
import { exportNycOpenDataDataset } from "@nyc-transit-kit/nyc-open-data/client"
import { queryNycOpenDataDataset } from "@nyc-transit-kit/nyc-open-data/query"
import { runSoda3Effect } from "./internal/run"
import type { Soda3CompatOptions } from "./soda3"

export type { Soda3ClientError } from "./errors"
export {
  InvalidInputError,
  isRetryableProviderError,
  ProviderContractError,
  ProviderHttpError,
  RetryExhaustedError,
  TimeoutError
} from "./errors"

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
