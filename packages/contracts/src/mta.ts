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

export const GtfsFeedKind = Schema.Literals(["vehicle-positions", "trip-updates", "alerts"])
export type GtfsFeedKind = typeof GtfsFeedKind.Type

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
