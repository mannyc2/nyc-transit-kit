import { exportNycDotDataset, queryNycDotDataset } from "@nyc-transit-kit/nyc-dot/client"
import { runSoda3Effect } from "./internal/run"
import type { Soda3CompatOptions } from "./soda3"

export { isUnsupportedDatasetError, UnsupportedDatasetError } from "@nyc-transit-kit/nyc-dot/errors"
export type { Soda3ClientError } from "./errors"
export {
  InvalidInputError,
  isRetryableProviderError,
  ProviderContractError,
  ProviderHttpError,
  RetryExhaustedError,
  TimeoutError
} from "./errors"

type NycDotQueryInput = Parameters<typeof queryNycDotDataset>[0]
type NycDotExportInput = Parameters<typeof exportNycDotDataset>[0]

export const queryNycDotRows = (input: NycDotQueryInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(queryNycDotDataset(input), options)

export const exportNycDotResponse = (input: NycDotExportInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(exportNycDotDataset(input), options)
