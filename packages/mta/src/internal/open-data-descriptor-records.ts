import type { MtaOpenDataDatasetDescriptorInput } from "@nyc-transit-kit/contracts/mta"

export const mtaOpenDataDescriptorRecords = [
  {
    id: "f462-ka72",
    name: "MTA Open Data Catalog",
    domain: "data.ny.gov",
    backing: "socrata",
    description: "MTA Open Data catalog entry surfaced through NYS Open Data.",
    sourceUrl: "https://data.ny.gov/d/f462-ka72",
    tags: ["transportation", "transit", "catalog"],
    adapterStatus: "row-schema",
    lastVerified: "2026-06-16"
  }
] satisfies ReadonlyArray<MtaOpenDataDatasetDescriptorInput>
