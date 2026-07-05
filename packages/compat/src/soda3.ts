import { catalogSearch, type Soda3CatalogSearchRequestInput } from "@nyc-transit-kit/soda3/catalog"
import type { FetchImplementation } from "@nyc-transit-kit/soda3/client"
import { exportResponse, type Soda3ExportRequestInput } from "@nyc-transit-kit/soda3/export"
import {
  fetchDatasetMetadata,
  type Soda3DatasetMetadataRequestInput
} from "@nyc-transit-kit/soda3/metadata"
import {
  countRows,
  queryAllRows,
  queryRows,
  type Soda3CountRowsInput,
  type Soda3QueryAllRowsInput,
  type Soda3QueryRequestInput
} from "@nyc-transit-kit/soda3/query"
import { runSoda3Effect } from "./internal/runtime"
export interface Soda3CompatOptions {
  readonly appToken?: string
  readonly retryTimes?: number
  readonly retryDelayMs?: number
  readonly timeoutMs?: number
  readonly fetch?: FetchImplementation
}
export const querySoda3Rows = (input: Soda3QueryRequestInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(queryRows(input), options)
export const queryAllSoda3Rows = (input: Soda3QueryAllRowsInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(queryAllRows(input), options)
export const countSoda3Rows = (input: Soda3CountRowsInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(countRows(input), options)
export const exportSoda3Response = (input: Soda3ExportRequestInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(exportResponse(input), options)
export const searchSoda3Catalog = (
  input: Soda3CatalogSearchRequestInput,
  options?: Soda3CompatOptions
) => runSoda3Effect(catalogSearch(input), options)
export const fetchSoda3DatasetMetadata = (
  input: Soda3DatasetMetadataRequestInput,
  options?: Soda3CompatOptions
) => runSoda3Effect(fetchDatasetMetadata(input), options)
