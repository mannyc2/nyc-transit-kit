import { makeDescriptorRegistry } from "@nyc-transit-kit/contracts/descriptor-registry"
import { MtaOpenDataDatasetDescriptor } from "@nyc-transit-kit/contracts/mta"
import * as Schema from "effect/Schema"
import { mtaOpenDataDescriptorRecords } from "./internal/open-data-descriptor-records"

export const mtaOpenDataDomain = "data.ny.gov"

const decodeDescriptor = Schema.decodeUnknownSync(MtaOpenDataDatasetDescriptor)
const descriptorRegistry = makeDescriptorRegistry({
  descriptors: mtaOpenDataDescriptorRecords.map((record) => decodeDescriptor(record)),
  id: (dataset) => String(dataset.id)
})

const requireMtaOpenDataDescriptor = (datasetId: string) => {
  const descriptor = descriptorRegistry.findById(datasetId)
  if (descriptor === undefined) {
    throw new Error(`Missing MTA Open Data descriptor: ${datasetId}`)
  }
  return descriptor
}

export const mtaOpenDataCatalogDescriptor = requireMtaOpenDataDescriptor("f462-ka72")

export const mtaOpenDataDatasets: ReadonlyArray<MtaOpenDataDatasetDescriptor> =
  descriptorRegistry.all

export const findMtaOpenDataDataset = (datasetId: string) => descriptorRegistry.findById(datasetId)
