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
