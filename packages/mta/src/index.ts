export const packageName = "@nyc-transit-kit/mta"
export const gtfsStaticSurface = "gtfs-static"
export const gtfsRealtimeSurface = "gtfs-realtime"
export {
  findMtaOpenDataDataset,
  mtaOpenDataCatalogDescriptor,
  mtaOpenDataDatasets,
  mtaOpenDataDomain
} from "./datasets"
export type { MtaError } from "./errors"
export { MtaDecodeError, MtaHttpError, MtaInvalidInputError } from "./errors"
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
  GtfsRealtimeDecoder,
  probeGtfsRealtime
} from "./gtfs-realtime"
export {
  fetchGtfsStatic,
  fetchGtfsStaticResponse,
  MtaHttpLive,
  probeGtfsStatic
} from "./gtfs-static"
export { queryMtaOpenData } from "./open-data"
