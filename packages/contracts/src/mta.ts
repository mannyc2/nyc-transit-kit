import * as Schema from "effect/Schema"
import { SocrataDatasetId, SocrataDomain } from "./ids"
import { DatasetDescriptorMetadataFields } from "./metadata"
import { NonNegativeInteger } from "./soda3"

type WidenedStringInput<T extends string> = T | (string & {})
type WidenedGtfsFeedInput<Encoded extends { readonly feed: GtfsFeedKind }> = Omit<
  Encoded,
  "feed"
> & {
  readonly feed: WidenedStringInput<Encoded["feed"]>
}
type WidenedJsonDirectSurfaceInput<Encoded extends { readonly surface: MtaJsonDirectSurface }> =
  Omit<Encoded, "surface"> & {
    readonly surface: WidenedStringInput<Encoded["surface"]>
  }

export const GtfsFeedKind = Schema.Literals(["vehicle-positions", "trip-updates", "alerts"])
export type GtfsFeedKind = typeof GtfsFeedKind.Type

export const MtaJsonDirectSurface = Schema.Literals([
  "service-alerts",
  "elevator-escalator",
  "bus-time"
])
export type MtaJsonDirectSurface = typeof MtaJsonDirectSurface.Type

const Sha256Hex = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[a-f0-9]{64}$/, {
      message: "Expected a lowercase SHA-256 hex digest"
    })
  )
)

const IsoTimestamp = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, {
      message: "Expected an ISO timestamp produced by Date.toISOString()"
    })
  )
)

const GtfsRealtimeRequestFields = {
  feed: GtfsFeedKind,
  url: Schema.String
}

const GtfsRealtimeCaptureMetadataFields = {
  feed: GtfsFeedKind,
  status: Schema.Number,
  byteLength: NonNegativeInteger,
  sha256: Sha256Hex,
  capturedAt: IsoTimestamp,
  url: Schema.String
}

export class MtaGtfsStaticFetchRequest extends Schema.Class<MtaGtfsStaticFetchRequest>(
  "MtaGtfsStaticFetchRequest"
)({
  url: Schema.String
}) {}
export type MtaGtfsStaticFetchRequestInput = Schema.Codec.Encoded<typeof MtaGtfsStaticFetchRequest>

export class MtaGtfsStaticProbeResult extends Schema.Class<MtaGtfsStaticProbeResult>(
  "MtaGtfsStaticProbeResult"
)({
  url: Schema.String,
  ok: Schema.Boolean,
  status: Schema.Number,
  contentType: Schema.optionalKey(Schema.String),
  contentLength: Schema.optionalKey(Schema.Number)
}) {}

export class MtaGtfsRealtimeProbeRequest extends Schema.Class<MtaGtfsRealtimeProbeRequest>(
  "MtaGtfsRealtimeProbeRequest"
)({ ...GtfsRealtimeRequestFields }) {}
type MtaGtfsRealtimeProbeRequestEncoded = Schema.Codec.Encoded<typeof MtaGtfsRealtimeProbeRequest>
export type MtaGtfsRealtimeProbeRequestInput =
  WidenedGtfsFeedInput<MtaGtfsRealtimeProbeRequestEncoded>

export class MtaGtfsRealtimeCaptureRequest extends Schema.Class<MtaGtfsRealtimeCaptureRequest>(
  "MtaGtfsRealtimeCaptureRequest"
)({ ...GtfsRealtimeRequestFields }) {}
type MtaGtfsRealtimeCaptureRequestEncoded = Schema.Codec.Encoded<
  typeof MtaGtfsRealtimeCaptureRequest
>
export type MtaGtfsRealtimeCaptureRequestInput =
  WidenedGtfsFeedInput<MtaGtfsRealtimeCaptureRequestEncoded>

export class MtaGtfsRealtimeDecodedHeader extends Schema.Class<MtaGtfsRealtimeDecodedHeader>(
  "MtaGtfsRealtimeDecodedHeader"
)({
  gtfsRealtimeVersion: Schema.optionalKey(Schema.String),
  incrementality: Schema.optionalKey(Schema.String),
  timestamp: Schema.optionalKey(Schema.Number)
}) {}

export class MtaGtfsRealtimeDecodedSummary extends Schema.Class<MtaGtfsRealtimeDecodedSummary>(
  "MtaGtfsRealtimeDecodedSummary"
)({
  feed: GtfsFeedKind,
  entityCount: NonNegativeInteger,
  tripUpdateCount: NonNegativeInteger,
  vehiclePositionCount: NonNegativeInteger,
  alertCount: NonNegativeInteger,
  header: Schema.optionalKey(MtaGtfsRealtimeDecodedHeader),
  raw: Schema.Unknown
}) {}

export class MtaGtfsRealtimeProbeResult extends Schema.Class<MtaGtfsRealtimeProbeResult>(
  "MtaGtfsRealtimeProbeResult"
)({
  feed: GtfsFeedKind,
  ok: Schema.Boolean,
  status: Schema.Number,
  byteLength: NonNegativeInteger,
  decoded: Schema.optionalKey(MtaGtfsRealtimeDecodedSummary)
}) {}

export class MtaGtfsRealtimeCaptureManifest extends Schema.Class<MtaGtfsRealtimeCaptureManifest>(
  "MtaGtfsRealtimeCaptureManifest"
)({ ...GtfsRealtimeCaptureMetadataFields }) {}

export class MtaGtfsRealtimeCaptureResult extends Schema.Class<MtaGtfsRealtimeCaptureResult>(
  "MtaGtfsRealtimeCaptureResult"
)({
  ...GtfsRealtimeCaptureMetadataFields,
  bytes: Schema.Uint8Array
}) {}

export class MtaJsonDirectFetchRequest extends Schema.Class<MtaJsonDirectFetchRequest>(
  "MtaJsonDirectFetchRequest"
)({
  surface: MtaJsonDirectSurface,
  url: Schema.String,
  apiKey: Schema.optionalKey(Schema.String),
  apiKeyParameterName: Schema.optionalKey(Schema.String),
  query: Schema.optionalKey(Schema.Record(Schema.String, Schema.String))
}) {}
type MtaJsonDirectFetchRequestEncoded = Schema.Codec.Encoded<typeof MtaJsonDirectFetchRequest>
export type MtaJsonDirectFetchRequestInput =
  WidenedJsonDirectSurfaceInput<MtaJsonDirectFetchRequestEncoded>

export class MtaJsonDirectFetchResult extends Schema.Class<MtaJsonDirectFetchResult>(
  "MtaJsonDirectFetchResult"
)({
  surface: MtaJsonDirectSurface,
  status: Schema.Number,
  url: Schema.String,
  contentType: Schema.optionalKey(Schema.String),
  json: Schema.Unknown
}) {}

export class MtaOpenDataDatasetDescriptor extends Schema.Class<MtaOpenDataDatasetDescriptor>(
  "MtaOpenDataDatasetDescriptor"
)({
  id: SocrataDatasetId,
  name: Schema.String,
  domain: SocrataDomain,
  backing: Schema.Literal("socrata"),
  description: Schema.optionalKey(Schema.String),
  ...DatasetDescriptorMetadataFields
}) {}
export type MtaOpenDataDatasetDescriptorInput = Schema.Codec.Encoded<
  typeof MtaOpenDataDatasetDescriptor
>

export class MtaOpenDataCatalogRow extends Schema.Class<MtaOpenDataCatalogRow>(
  "MtaOpenDataCatalogRow"
)({
  "Open Dataset ID": Schema.optionalKey(Schema.String),
  Name: Schema.optionalKey(Schema.String),
  Description: Schema.optionalKey(Schema.String)
}) {}

export class MtaElevatorEscalatorCurrentRow extends Schema.Class<MtaElevatorEscalatorCurrentRow>(
  "MtaElevatorEscalatorCurrentRow"
)({
  station: Schema.optionalKey(Schema.String),
  borough: Schema.optionalKey(Schema.String),
  trainno: Schema.optionalKey(Schema.String),
  equipment: Schema.optionalKey(Schema.String),
  equipmenttype: Schema.optionalKey(Schema.String),
  serving: Schema.optionalKey(Schema.String),
  ADA: Schema.optionalKey(Schema.String),
  outagedate: Schema.optionalKey(Schema.String),
  estimatedreturntoservice: Schema.optionalKey(Schema.String),
  reason: Schema.optionalKey(Schema.String),
  isupcomingoutage: Schema.optionalKey(Schema.String),
  ismaintenanceoutage: Schema.optionalKey(Schema.String)
}) {}

export const MtaElevatorEscalatorCurrent = Schema.Array(MtaElevatorEscalatorCurrentRow)
