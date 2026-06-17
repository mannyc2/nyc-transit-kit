import { makeDescriptorRegistry } from "@nyc-transit-kit/contracts/descriptor-registry"
import { NycDotDatasetDescriptor } from "@nyc-transit-kit/contracts/nyc-dot"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { UnsupportedDatasetError } from "./errors"
import { nycDotDescriptorRecords } from "./internal/descriptor-records"

export const nycDotOpenDataDomain = "data.cityofnewyork.us"

const decodeDescriptor = Schema.decodeUnknownSync(NycDotDatasetDescriptor)
const descriptorRegistry = makeDescriptorRegistry({
  descriptors: nycDotDescriptorRecords.map((record) => decodeDescriptor(record)),
  id: (dataset) => String(dataset.id),
  lookupKeys: (dataset) => [String(dataset.name)]
})

const requireKnownNycDotDescriptor = (name: string) => {
  const descriptor = descriptorRegistry.find(name)
  if (descriptor === undefined) {
    throw new Error(`Missing NYC DOT descriptor: ${name}`)
  }
  return descriptor
}

export const busLanesLocalStreets = requireKnownNycDotDescriptor("bus-lanes-local-streets")

export const trafficSpeeds = requireKnownNycDotDescriptor("traffic-speeds")

export const trafficVolumeCounts = requireKnownNycDotDescriptor("traffic-volume-counts")

export const nycDotDatasets: ReadonlyArray<NycDotDatasetDescriptor> = descriptorRegistry.all

export const initialDatasetIds = descriptorRegistry.ids

export const findNycDotDataset = (name: string) => descriptorRegistry.find(name)

export const requireNycDotDataset = (name: string) => {
  const dataset = findNycDotDataset(name)
  if (dataset !== undefined) {
    return Effect.succeed(dataset)
  }

  return Effect.fail(
    UnsupportedDatasetError.make({
      dataset: name,
      message: `Unsupported NYC DOT dataset: ${name}`
    })
  )
}
