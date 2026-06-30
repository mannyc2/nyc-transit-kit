import { catalogSearch, type Soda3CatalogSearchRequestInput } from "@nyc-transit-kit/soda3/catalog"
import { exportResponse, type Soda3ExportRequestInput } from "@nyc-transit-kit/soda3/export"
import { queryRows, type Soda3QueryRequestInput } from "@nyc-transit-kit/soda3/query"
import { runSoda3Effect } from "./internal/run"

export type { Soda3ClientError } from "@nyc-transit-kit/soda3/errors"
export {
  InvalidInputError,
  isRetryableProviderError,
  isSoda3ClientError,
  ProviderContractError,
  ProviderHttpError,
  RetryExhaustedError,
  TimeoutError
} from "@nyc-transit-kit/soda3/errors"

export interface Soda3CompatOptions {
  readonly appToken?: string
  readonly retryTimes?: number
  readonly fetch?: typeof fetch
}

export const querySoda3Rows = (input: Soda3QueryRequestInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(queryRows(input), options)

export const exportSoda3Response = (input: Soda3ExportRequestInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(exportResponse(input), options)

export const searchSoda3Catalog = (
  input: Soda3CatalogSearchRequestInput,
  options?: Soda3CompatOptions
) => runSoda3Effect(catalogSearch(input), options)
