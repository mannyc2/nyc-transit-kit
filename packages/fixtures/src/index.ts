export const packageName = "@nyc-transit-kit/fixtures"
export const fixturePolicy = "small-public-or-synthetic"

export const sampleSocrataDatasetId = "abcd-1234"
export const sampleSocrataDomain = "data.example.gov"

export const sampleSoda3QueryResponse = {
  rows: [
    {
      station: "Canal St",
      line: "A"
    }
  ],
  rowCount: 1
}

export const sampleSocrataCatalogResponse = {
  results: [
    {
      resource: {
        id: sampleSocrataDatasetId,
        name: "Synthetic Transit Stations",
        type: "dataset",
        description: "Small synthetic fixture for client tests.",
        attribution: "Synthetic Transit Lab",
        updatedAt: "2026-07-04T00:00:00.000Z",
        createdAt: "2026-07-01T00:00:00.000Z",
        metadata_updated_at: "2026-07-04T00:00:00.000Z",
        data_updated_at: "2026-07-03T00:00:00.000Z",
        publication_date: "2026-07-02T00:00:00.000Z",
        columns_name: ["Station", "Line"],
        columns_field_name: ["station", "line"],
        columns_datatype: ["text", "text"],
        columns_description: ["Station name", "Transit line"]
      },
      classification: {
        categories: ["Transportation"],
        tags: ["synthetic", "transit"],
        domain_category: "Transportation",
        domain_tags: ["Transit"],
        domain_metadata: [
          {
            key: "Update_Update-Frequency",
            value: "Monthly"
          }
        ]
      },
      metadata: {
        domain: sampleSocrataDomain,
        rowLabel: "station"
      },
      permalink: `https://${sampleSocrataDomain}/d/${sampleSocrataDatasetId}`,
      link: `https://${sampleSocrataDomain}/d/${sampleSocrataDatasetId}`
    }
  ],
  resultSetSize: 1,
  warnings: []
}

export const sampleMtaOpenDataCatalogRow = {
  "Open Dataset ID": "f462-ka72",
  Name: "MTA Open Data Catalog",
  Description: "Synthetic row for the MTA Open Data catalog adapter."
}

// Synthetic FeedMessage (1 vehicle-position entity), generated with
// gtfs-realtime-bindings@2.0.0. Decode with @nyc-transit-kit/mta/gtfs-realtime.
export const sampleGtfsRealtimeFeedMessageBase64 =
  "CgUKAzIuMBIiCgd2ZWhpY2xlIhcKCAoGdHJpcC0xQgsKCXZlaGljbGUtMQ=="

export const sampleGtfsRealtimeFeedMessageBytes = () =>
  Uint8Array.from(atob(sampleGtfsRealtimeFeedMessageBase64), (character) => character.charCodeAt(0))

export const sampleMtaElevatorEscalatorCurrentJson = [
  {
    station: "Example Station",
    borough: "M",
    trainno: "A/C/E",
    equipment: "EL001",
    equipmenttype: "EL",
    serving: "street to mezzanine",
    ADA: "Y",
    outagedate: "01/01/2026 12:00:00 AM",
    estimatedreturntoservice: "01/02/2026 12:00:00 AM",
    reason: "Repair",
    isupcomingoutage: "N",
    ismaintenanceoutage: "N"
  }
]
