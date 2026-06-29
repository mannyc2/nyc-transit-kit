import { describe, expect, test } from "bun:test"
import {
  fixturePolicy,
  packageName,
  sampleMtaElevatorEscalatorCurrentJson,
  sampleMtaOpenDataCatalogRow,
  sampleSocrataCatalogResponse,
  sampleSocrataDatasetId,
  sampleSoda3QueryResponse
} from "../src/index"

describe("@nyc-transit-kit/fixtures", () => {
  test("declares the fixture publication policy", () => {
    expect(packageName).toBe("@nyc-transit-kit/fixtures")
    expect(fixturePolicy).toBe("small-public-or-synthetic")
  })

  test("exposes tiny generic Socrata fixtures", () => {
    expect(sampleSocrataDatasetId).toBe("abcd-1234")
    expect(sampleSoda3QueryResponse.rowCount).toBe(1)
    expect(sampleSocrataCatalogResponse.results).toHaveLength(1)
  })

  test("exposes tiny selected MTA adapter fixtures", () => {
    expect(sampleMtaOpenDataCatalogRow["Open Dataset ID"]).toBe("f462-ka72")
    expect(sampleMtaOpenDataCatalogRow.Name).toBe("MTA Open Data Catalog")
    expect(sampleMtaElevatorEscalatorCurrentJson).toHaveLength(1)
    expect(JSON.stringify(sampleMtaOpenDataCatalogRow).length).toBeLessThan(512)
    expect(JSON.stringify(sampleMtaElevatorEscalatorCurrentJson).length).toBeLessThan(1024)
  })
})
