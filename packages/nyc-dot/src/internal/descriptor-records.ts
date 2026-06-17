import type { NycDotDatasetDescriptorInput } from "@nyc-transit-kit/contracts/nyc-dot"

export const nycDotDescriptorRecords = [
  {
    name: "bus-lanes-local-streets",
    id: "ycrg-ses3",
    title: "Bus Lanes - Local Streets",
    domain: "data.cityofnewyork.us",
    backing: "socrata",
    description: "NYC DOT bus lane centerline dataset hosted on NYC Open Data.",
    sourceUrl: "https://data.cityofnewyork.us/d/ycrg-ses3",
    tags: ["transportation", "transit"],
    adapterStatus: "row-schema",
    lastVerified: "2026-06-16"
  },
  {
    name: "traffic-speeds",
    id: "i4gi-tjb9",
    title: "DOT Traffic Speeds",
    domain: "data.cityofnewyork.us",
    backing: "socrata",
    description: "NYC DOT realtime traffic speeds dataset hosted on NYC Open Data.",
    sourceUrl: "https://data.cityofnewyork.us/d/i4gi-tjb9",
    tags: ["transportation", "traffic"],
    temporalFields: ["data_as_of"],
    adapterStatus: "row-schema",
    lastVerified: "2026-06-16"
  },
  {
    name: "traffic-volume-counts",
    id: "btm5-ppia",
    title: "Traffic Volume Counts Historical",
    domain: "data.cityofnewyork.us",
    backing: "socrata",
    description: "NYC DOT historical traffic volume counts dataset hosted on NYC Open Data.",
    sourceUrl: "https://data.cityofnewyork.us/d/btm5-ppia",
    tags: ["transportation", "traffic"],
    temporalFields: ["count_date"],
    adapterStatus: "row-schema",
    lastVerified: "2026-06-16"
  }
] satisfies ReadonlyArray<NycDotDatasetDescriptorInput>
