import * as Schema from "effect/Schema"
import { IsoDate, SocrataDatasetId, SocrataDomain } from "./ids"
export type DescriptorRegistryOptions<Descriptor> = {
  readonly descriptors: ReadonlyArray<Descriptor>
  readonly id: (descriptor: Descriptor) => string
  readonly lookupKeys?: (descriptor: Descriptor) => ReadonlyArray<string>
}
export type DescriptorRegistry<Descriptor> = {
  readonly all: ReadonlyArray<Descriptor>
  readonly ids: ReadonlyArray<string>
  readonly findById: (id: string) => Descriptor | undefined
  readonly find: (key: string) => Descriptor | undefined
}
export const DatasetDescriptorAdapterStatus = Schema.Literals(["none", "row-schema", "normalized"])
export type DatasetDescriptorAdapterStatus = typeof DatasetDescriptorAdapterStatus.Type
export const DatasetDescriptorMetadataFields = {
  sourceUrl: Schema.optionalKey(Schema.String),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
  temporalFields: Schema.optionalKey(Schema.Array(Schema.String)),
  adapterStatus: Schema.optionalKey(DatasetDescriptorAdapterStatus),
  lastVerified: Schema.optionalKey(IsoDate)
}
const socrataDescriptorFields = {
  id: SocrataDatasetId,
  domain: SocrataDomain,
  backing: Schema.Literal("socrata"),
  description: Schema.optionalKey(Schema.String),
  ...DatasetDescriptorMetadataFields
}
const nycDotDatasetNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const duplicateError = (kind: string, key: string) =>
  new Error(`Duplicate descriptor ${kind}: ${key}`)
export const NycDotDatasetName = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(nycDotDatasetNamePattern, {
      message: "Expected a lower-kebab NYC DOT dataset name"
    })
  ),
  Schema.brand("NycDotDatasetName")
)
export type NycDotDatasetName = typeof NycDotDatasetName.Type
export const makeDescriptorRegistry = <Descriptor>(
  options: DescriptorRegistryOptions<Descriptor>
): DescriptorRegistry<Descriptor> => {
  const all = [...options.descriptors]
  const ids: Array<string> = []
  const byId = new Map<string, Descriptor>()
  const byLookupKey = new Map<string, Descriptor>()
  const addLookupKey = (key: string, descriptor: Descriptor) => {
    if (byLookupKey.has(key)) {
      throw duplicateError("lookup key", key)
    }
    byLookupKey.set(key, descriptor)
  }
  for (const descriptor of all) {
    const id = options.id(descriptor)
    if (byId.has(id)) {
      throw duplicateError("id", id)
    }
    byId.set(id, descriptor)
    ids.push(id)
    addLookupKey(id, descriptor)
    for (const key of options.lookupKeys?.(descriptor) ?? []) {
      addLookupKey(key, descriptor)
    }
  }
  return {
    all,
    ids,
    findById: (id) => byId.get(id),
    find: (key) => byLookupKey.get(key)
  }
}
export class NycDotDatasetDescriptor extends Schema.Class<NycDotDatasetDescriptor>(
  "NycDotDatasetDescriptor"
)({
  ...socrataDescriptorFields,
  name: NycDotDatasetName,
  title: Schema.String
}) {}
export type NycDotDatasetDescriptorInput = Schema.Codec.Encoded<typeof NycDotDatasetDescriptor>
export class NycOpenDataDatasetDescriptor extends Schema.Class<NycOpenDataDatasetDescriptor>(
  "NycOpenDataDatasetDescriptor"
)({
  ...socrataDescriptorFields,
  name: Schema.String,
  agency: Schema.optionalKey(Schema.String)
}) {}
export type NycOpenDataDatasetDescriptorInput = Schema.Codec.Encoded<
  typeof NycOpenDataDatasetDescriptor
>
export class NycOpenDataDatasetInfoRequest extends Schema.Class<NycOpenDataDatasetInfoRequest>(
  "NycOpenDataDatasetInfoRequest"
)({
  datasetId: SocrataDatasetId
}) {}
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
