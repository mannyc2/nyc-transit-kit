import {
  makeDescriptorRegistry,
  NycOpenDataDatasetDescriptor
} from "@nyc-transit-kit/contracts/descriptors"
import * as Schema from "effect/Schema"
import { nycOpenDataDescriptorRecords } from "./internal/descriptor-records"

export const defaultDomain = "data.cityofnewyork.us"

const decodeDescriptor = Schema.decodeUnknownSync(NycOpenDataDatasetDescriptor)
const descriptorRegistry = makeDescriptorRegistry({
  descriptors: nycOpenDataDescriptorRecords.map((record) => decodeDescriptor(record)),
  id: (dataset) => String(dataset.id)
})

export const knownNycOpenDataDatasets: ReadonlyArray<NycOpenDataDatasetDescriptor> =
  descriptorRegistry.all

export const findNycOpenDataDataset = (datasetId: string) => descriptorRegistry.findById(datasetId)
