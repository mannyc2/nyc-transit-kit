import { describe, expect, test } from "bun:test"
import {
  fixturePolicy,
  packageName,
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
})
