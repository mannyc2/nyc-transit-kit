export const packageName = "@nyc-transit-kit/soda3"
export { buildCatalogSearchUrl, catalogSearch } from "./catalog"
export type { Soda3ClientConfigShape } from "./client"
export { Soda3ClientConfig, Soda3HttpLive, Soda3Live } from "./client"
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
export { queryRows } from "./query"
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
