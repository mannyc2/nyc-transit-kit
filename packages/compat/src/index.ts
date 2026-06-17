export const packageName = "@nyc-transit-kit/compat"
export const facadeStyle = "promise-over-effect"
export type { MtaCompatOptions } from "./mta"
export { fetchMtaGtfsStaticBytes, probeMtaGtfsRealtime } from "./mta"
export { queryNycDotRows } from "./nyc-dot"
export { queryNycOpenDataRows, searchNycOpenData } from "./nyc-open-data"
export type { Soda3CompatOptions } from "./soda3"
export {
  exportSoda3Response,
  querySoda3Rows,
  searchSoda3Catalog
} from "./soda3"
