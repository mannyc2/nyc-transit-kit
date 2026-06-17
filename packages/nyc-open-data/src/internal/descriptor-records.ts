import type { NycOpenDataDatasetDescriptorInput } from "@nyc-transit-kit/contracts/nyc-open-data"

export const nycOpenDataDescriptorRecords = [
  {
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
  },
  {
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
  },
  {
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
  }
] satisfies ReadonlyArray<NycOpenDataDatasetDescriptorInput>
