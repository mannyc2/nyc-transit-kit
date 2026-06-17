import { makeDescriptorRegistry } from "@nyc-transit-kit/contracts/descriptor-registry"
import { NycOpenDataDatasetDescriptor } from "@nyc-transit-kit/contracts/nyc-open-data"
import * as Schema from "effect/Schema"
import { nycOpenDataDescriptorRecords } from "./internal/descriptor-records"

export const defaultDomain = "data.cityofnewyork.us"

const decodeDescriptor = Schema.decodeUnknownSync(NycOpenDataDatasetDescriptor)
const descriptorRegistry = makeDescriptorRegistry({
  descriptors: nycOpenDataDescriptorRecords.map((record) => decodeDescriptor(record)),
  id: (dataset) => String(dataset.id)
})

const requireNycOpenDataDescriptor = (datasetId: string) => {
  const descriptor = descriptorRegistry.findById(datasetId)
  if (descriptor === undefined) {
    throw new Error(`Missing NYC Open Data descriptor: ${datasetId}`)
  }
  return descriptor
}

export const busLanesLocalStreetsDescriptor = requireNycOpenDataDescriptor("ycrg-ses3")

export const dotTrafficSpeedsDescriptor = requireNycOpenDataDescriptor("i4gi-tjb9")

export const trafficVolumeCountsDescriptor = requireNycOpenDataDescriptor("btm5-ppia")

export const knownNycOpenDataDatasets: ReadonlyArray<NycOpenDataDatasetDescriptor> =
  descriptorRegistry.all

export const findNycOpenDataDataset = (datasetId: string) => descriptorRegistry.findById(datasetId)
