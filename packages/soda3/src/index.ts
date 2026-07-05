export const packageName = "@nyc-transit-kit/soda3"
export { buildCatalogSearchUrl, catalogSearch } from "./catalog"
export type { FetchImplementation, Soda3ClientConfigShape, Soda3LayerOptions } from "./client"
export {
  Soda3ClientConfig,
  Soda3HttpLive,
  Soda3Live,
  soda3ConfigLayer,
  soda3FetchLayer,
  soda3Layer
} from "./client"
export {
  buildExportUrl,
  buildQueryUrl,
  decodeSoda3CatalogSearchRequest,
  decodeSoda3ExportRequest,
  decodeSoda3QueryRequest,
  defaultSocrataProtocol,
  discoveryApiHost,
  socrataApiVersion
} from "./endpoints"
export type { Soda3ClientError } from "./errors"
export {
  InvalidInputError,
  isRetryableProviderError,
  isSoda3ClientError,
  ProviderContractError,
  ProviderHttpError,
  RetryExhaustedError,
  TimeoutError
} from "./errors"
export { exportResponse } from "./export"
export type { Soda3DatasetMetadataRequestInput } from "./metadata"
export { fetchDatasetMetadata } from "./metadata"
export type { Soda3CountRowsInput, Soda3QueryAllRowsInput } from "./query"
export { countRows, queryAllRows, queryRows } from "./query"
export type {
  SocrataTimestampWindow,
  SocrataYearMonth,
  SoqlFragment,
  SoqlParameters,
  SoqlSortDirection
} from "./soql"
export {
  socrataDateWindow,
  socrataMonthWindow,
  socrataTimestamp,
  soqlAnd,
  soqlEq,
  soqlIdentifier,
  soqlIn,
  soqlIsNotNull,
  soqlLimit,
  soqlMonthWindow,
  soqlOrderBy,
  soqlParameter,
  soqlParameterName,
  soqlSelectAll,
  soqlTimestampRange,
  soqlYearMonthRange
} from "./soql"
