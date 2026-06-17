import * as Schema from "effect/Schema"
import { SocrataDatasetId, SocrataDomain } from "./ids"
import { DatasetDescriptorMetadataFields } from "./metadata"

export class NycOpenDataDatasetDescriptor extends Schema.Class<NycOpenDataDatasetDescriptor>(
  "NycOpenDataDatasetDescriptor"
)({
  id: SocrataDatasetId,
  name: Schema.String,
  domain: SocrataDomain,
  agency: Schema.optionalKey(Schema.String),
  backing: Schema.Literal("socrata"),
  description: Schema.optionalKey(Schema.String),
  ...DatasetDescriptorMetadataFields
}) {}
export type NycOpenDataDatasetDescriptorInput = Schema.Codec.Encoded<
  typeof NycOpenDataDatasetDescriptor
>

export class NycOpenDataDatasetInfoRequest extends Schema.Class<NycOpenDataDatasetInfoRequest>(
  "NycOpenDataDatasetInfoRequest"
)({
  datasetId: SocrataDatasetId
}) {}
