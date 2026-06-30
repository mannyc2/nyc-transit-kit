import { isMtaError, type MtaError } from "@nyc-transit-kit/mta/errors"
import {
  isUnsupportedDatasetError,
  type UnsupportedDatasetError
} from "@nyc-transit-kit/nyc-dot/errors"
import { isSoda3ClientError, type Soda3ClientError } from "@nyc-transit-kit/soda3/errors"

export type { MtaError } from "@nyc-transit-kit/mta/errors"
export {
  isMtaError,
  MtaDecodeError,
  MtaHttpError,
  MtaInvalidInputError
} from "@nyc-transit-kit/mta/errors"
export { isUnsupportedDatasetError, UnsupportedDatasetError } from "@nyc-transit-kit/nyc-dot/errors"
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

export type TransitKitCompatError = Soda3ClientError | MtaError | UnsupportedDatasetError

export const isTransitKitCompatError = (value: unknown): value is TransitKitCompatError =>
  isSoda3ClientError(value) || isMtaError(value) || isUnsupportedDatasetError(value)
