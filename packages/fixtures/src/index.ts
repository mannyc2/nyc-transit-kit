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
        domain: sampleSocrataDomain,
        type: "dataset",
        description: "Small synthetic fixture for client tests."
      },
      metadata: {
        rowLabel: "station"
      }
    }
  ],
  resultCount: 1
}

export const sampleMtaOpenDataCatalogRow = {
  "Open Dataset ID": "f462-ka72",
  Name: "MTA Open Data Catalog",
  Description: "Synthetic row for the MTA Open Data catalog adapter."
}

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
