export const packageName = "@nyc-transit-kit/mta"
export type { MtaClientConfigShape, MtaLayerOptions } from "./client"
export {
  MtaClientConfig,
  MtaHttpLive,
  MtaLive,
  mtaConfigLayer,
  mtaFetchLayer,
  mtaLayer
} from "./client"
export type { MtaError } from "./errors"
export {
  isMtaError,
  MtaDecodeError,
  MtaHttpError,
  MtaInvalidInputError,
  MtaRetryExhaustedError,
  MtaTimeoutError
} from "./errors"
export type {
  MtaDirectFeedDescriptor,
  MtaDirectFeedSurface,
  MtaGtfsRealtimeFeedDescriptor,
  MtaGtfsStaticFeedDescriptor,
  MtaJsonDirectFeedDescriptor
} from "./feeds"
export {
  findMtaGtfsRealtimeFeed,
  findMtaGtfsStaticFeed,
  findMtaJsonDirectFeed,
  mtaDirectFeeds,
  mtaGtfsRealtimeFeeds,
  mtaGtfsStaticFeeds,
  mtaJsonDirectFeeds
} from "./feeds"
export type {
  GtfsRealtimeDecoderImplementation,
  MtaGtfsRealtimeCaptureRequestInput,
  MtaGtfsRealtimeProbeRequestInput
} from "./gtfs-realtime"
export {
  captureGtfsRealtime,
  decodeGtfsRealtimeBytes,
  decodeGtfsRealtimeBytesSync,
  GtfsRealtimeDecoder,
  probeGtfsRealtime
} from "./gtfs-realtime"
export {
  fetchGtfsStatic,
  fetchGtfsStaticResponse,
  probeGtfsStatic
} from "./gtfs-static"
export type { MtaJsonDirectFetchRequestInput } from "./json-direct"
export {
  decodeMtaElevatorEscalatorCurrent,
  fetchMtaJsonDirect,
  redactMtaJsonDirectUrl
} from "./json-direct"
export {
  decodeMtaOpenDataCatalogRow,
  decodeMtaOpenDataCatalogRows,
  findMtaOpenDataDataset,
  mtaOpenDataCatalogDescriptor,
  mtaOpenDataDatasets,
  mtaOpenDataDomain,
  queryMtaOpenData
} from "./open-data"
