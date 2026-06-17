import * as Schema from "effect/Schema"
import { SocrataDatasetId, SocrataDomain } from "./ids"
import { DatasetDescriptorMetadataFields } from "./metadata"

const nycDotDatasetNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const NycDotDatasetName = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(nycDotDatasetNamePattern, {
      message: "Expected a lower-kebab NYC DOT dataset name"
    })
  ),
  Schema.brand("NycDotDatasetName")
)
export type NycDotDatasetName = typeof NycDotDatasetName.Type

export class NycDotDatasetDescriptor extends Schema.Class<NycDotDatasetDescriptor>(
  "NycDotDatasetDescriptor"
)({
  name: NycDotDatasetName,
  id: SocrataDatasetId,
  title: Schema.String,
  domain: SocrataDomain,
  backing: Schema.Literal("socrata"),
  description: Schema.optionalKey(Schema.String),
  ...DatasetDescriptorMetadataFields
}) {}
export type NycDotDatasetDescriptorInput = Schema.Codec.Encoded<typeof NycDotDatasetDescriptor>

export class NycDotBusLaneRow extends Schema.Class<NycDotBusLaneRow>("NycDotBusLaneRow")({
  street: Schema.optionalKey(Schema.String),
  borough: Schema.optionalKey(Schema.String),
  fromStreet: Schema.optionalKey(Schema.String),
  toStreet: Schema.optionalKey(Schema.String)
}) {}

export class NycDotTrafficSpeedRow extends Schema.Class<NycDotTrafficSpeedRow>(
  "NycDotTrafficSpeedRow"
)({
  linkId: Schema.optionalKey(Schema.String),
  speed: Schema.optionalKey(Schema.String),
  travelTime: Schema.optionalKey(Schema.String),
  dataAsOf: Schema.optionalKey(Schema.String)
}) {}

export class NycDotTrafficVolumeRow extends Schema.Class<NycDotTrafficVolumeRow>(
  "NycDotTrafficVolumeRow"
)({
  requestId: Schema.optionalKey(Schema.String),
  segmentId: Schema.optionalKey(Schema.String),
  roadwayName: Schema.optionalKey(Schema.String),
  countDate: Schema.optionalKey(Schema.String)
}) {}
