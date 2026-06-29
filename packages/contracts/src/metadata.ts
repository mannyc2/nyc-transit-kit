import * as Schema from "effect/Schema"
import { IsoDate } from "./ids"

export const packageName = "@nyc-transit-kit/contracts"
export const schemaVersion = "0.1.0"
export const releaseVersion = "0.1.1"

export const ApiFamily = Schema.Literals(["socrata", "mta", "nyc-open-data", "nyc-dot"])
export type ApiFamily = typeof ApiFamily.Type

export const CliEnvelopeStatus = Schema.Literals(["success", "error"])
export type CliEnvelopeStatus = typeof CliEnvelopeStatus.Type

export const DatasetDescriptorAdapterStatus = Schema.Literals(["none", "row-schema", "normalized"])
export type DatasetDescriptorAdapterStatus = typeof DatasetDescriptorAdapterStatus.Type

export const DatasetDescriptorMetadataFields = {
  sourceUrl: Schema.optionalKey(Schema.String),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
  temporalFields: Schema.optionalKey(Schema.Array(Schema.String)),
  adapterStatus: Schema.optionalKey(DatasetDescriptorAdapterStatus),
  lastVerified: Schema.optionalKey(IsoDate)
}
