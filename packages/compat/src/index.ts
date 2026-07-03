export const packageName = "@nyc-transit-kit/compat"
export const facadeStyle = "promise-over-effect"
export type { MtaError, Soda3ClientError, TransitKitCompatError } from "./errors"
export {
  InvalidInputError,
  isMtaError,
  isRetryableProviderError,
  isSoda3ClientError,
  isTransitKitCompatError,
  isUnsupportedDatasetError,
  MtaDecodeError,
  MtaHttpError,
  MtaInvalidInputError,
  ProviderContractError,
  ProviderHttpError,
  RetryExhaustedError,
  TimeoutError,
  UnsupportedDatasetError
} from "./errors"
export type { MtaCompatOptions } from "./mta"
export {
  captureMtaGtfsRealtime,
  fetchMtaGtfsStaticBytes,
  fetchMtaGtfsStaticResponse,
  fetchMtaJsonDirect,
  probeMtaGtfsRealtime,
  probeMtaGtfsStatic,
  queryMtaOpenDataRows
} from "./mta"
export { exportNycDotResponse, queryNycDotRows } from "./nyc-dot"
export {
  exportNycOpenDataResponse,
  queryNycOpenDataRows,
  searchNycOpenData
} from "./nyc-open-data"
export type { Soda3CompatOptions } from "./soda3"
export {
  exportSoda3Response,
  querySoda3Rows,
  searchSoda3Catalog
} from "./soda3"
