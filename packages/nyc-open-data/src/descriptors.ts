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

/** @deprecated DOT-owned dataset. Use `@nyc-transit-kit/nyc-dot/datasets` instead. */
export const busLanesLocalStreetsDescriptor = decodeDescriptor({
  id: "ycrg-ses3",
  name: "Bus Lanes - Local Streets",
  domain: "data.cityofnewyork.us",
  agency: "DOT",
  backing: "socrata",
  description: "NYC DOT bus lane centerline dataset hosted on NYC Open Data.",
  sourceUrl: "https://data.cityofnewyork.us/d/ycrg-ses3",
  tags: ["transportation", "transit"],
  adapterStatus: "none",
  lastVerified: "2026-06-16"
})

/** @deprecated DOT-owned dataset. Use `@nyc-transit-kit/nyc-dot/datasets` instead. */
export const dotTrafficSpeedsDescriptor = decodeDescriptor({
  id: "i4gi-tjb9",
  name: "DOT Traffic Speeds",
  domain: "data.cityofnewyork.us",
  agency: "DOT",
  backing: "socrata",
  description: "NYC DOT traffic speeds dataset hosted on NYC Open Data.",
  sourceUrl: "https://data.cityofnewyork.us/d/i4gi-tjb9",
  tags: ["transportation", "traffic"],
  temporalFields: ["data_as_of"],
  adapterStatus: "none",
  lastVerified: "2026-06-16"
})

/** @deprecated DOT-owned dataset. Use `@nyc-transit-kit/nyc-dot/datasets` instead. */
export const trafficVolumeCountsDescriptor = decodeDescriptor({
  id: "btm5-ppia",
  name: "Traffic Volume Counts Historical",
  domain: "data.cityofnewyork.us",
  agency: "DOT",
  backing: "socrata",
  description: "NYC DOT historical traffic volume counts dataset hosted on NYC Open Data.",
  sourceUrl: "https://data.cityofnewyork.us/d/btm5-ppia",
  tags: ["transportation", "traffic"],
  temporalFields: ["count_date"],
  adapterStatus: "none",
  lastVerified: "2026-06-16"
})

export const knownNycOpenDataDatasets: ReadonlyArray<NycOpenDataDatasetDescriptor> =
  descriptorRegistry.all

export const findNycOpenDataDataset = (datasetId: string) => descriptorRegistry.findById(datasetId)
