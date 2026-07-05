import { describe, expect, test } from "bun:test"
import {
  fixturePolicy,
  packageName,
  sampleGtfsRealtimeFeedMessageBase64,
  sampleGtfsRealtimeFeedMessageBytes,
  sampleMtaElevatorEscalatorCurrentJson,
  sampleMtaOpenDataCatalogRow,
  sampleSocrataCatalogResponse,
  sampleSocrataDatasetId,
  sampleSocrataDomain,
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
    expect(sampleSocrataCatalogResponse.resultSetSize).toBe(1)
    expect(sampleSocrataCatalogResponse.results[0]?.metadata.domain).toBe(sampleSocrataDomain)
  })

  test("exposes tiny selected MTA adapter fixtures", () => {
    expect(sampleMtaOpenDataCatalogRow["Open Dataset ID"]).toBe("f462-ka72")
    expect(sampleMtaOpenDataCatalogRow.Name).toBe("MTA Open Data Catalog")
    expect(sampleMtaElevatorEscalatorCurrentJson).toHaveLength(1)
    expect(JSON.stringify(sampleMtaOpenDataCatalogRow).length).toBeLessThan(512)
    expect(JSON.stringify(sampleMtaElevatorEscalatorCurrentJson).length).toBeLessThan(1024)
  })

  test("exposes a tiny synthetic GTFS realtime fixture", () => {
    const bytes = sampleGtfsRealtimeFeedMessageBytes()

    expect(sampleGtfsRealtimeFeedMessageBase64.length).toBeGreaterThan(0)
    expect(bytes[0]).toBe(0x0a)
    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(bytes.byteLength).toBeLessThan(200)
  })
})
