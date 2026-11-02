import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import * as BusTime from "../../packages/mta/src/BusTime"
import * as ElevatorEscalator from "../../packages/mta/src/ElevatorEscalator"
import * as GtfsRealtime from "../../packages/mta/src/GtfsRealtime"
import * as GtfsStatic from "../../packages/mta/src/GtfsStatic"
import * as MtaOpenData from "../../packages/mta/src/MtaOpenData"
import * as NycDot from "../../packages/nyc-open-data/src/NycDot"
import * as NycOpenData from "../../packages/nyc-open-data/src/NycOpenData"
import { type CoverageProvider, coverageProviders } from "../../scripts/provider-coverage-shared"
import { runProviderCoverageCheck, runScript } from "./helpers"

const datasetGroups = [
  { label: "nyc-open-data", domain: "data.cityofnewyork.us", datasets: NycOpenData.datasets },
  { label: "nyc-dot", domain: "data.cityofnewyork.us", datasets: NycDot.datasets },
  { label: "mta-open-data", domain: "data.ny.gov", datasets: MtaOpenData.datasets }
]

const feedTables = [
  { label: "gtfs-static", host: "rrgtfsfeeds.s3.amazonaws.com", feeds: GtfsStatic.feeds },
  { label: "gtfs-realtime", host: "api-endpoint.mta.info", feeds: GtfsRealtime.feeds },
  { label: "elevator", host: "api-endpoint.mta.info", feeds: ElevatorEscalator.feeds },
  { label: "bus-time", host: "bustime.mta.info", feeds: BusTime.feeds }
]

const directFeeds = feedTables.flatMap(({ feeds }) =>
  Object.entries(feeds).map(([id, feed]) => ({ id, url: feed.url }))
)
const directFeedIds = [...new Set(directFeeds.map((feed) => feed.id))].toSorted()

const datasetIds = (datasets: Readonly<Record<string, { readonly datasetId: string }>>) =>
  Object.values(datasets).map((dataset) => dataset.datasetId)

const runProviderCoverageSet = async (
  entries: ReadonlyArray<{ readonly provider: CoverageProvider; readonly input: unknown }>
) => {
  const result = await runScript(
    "scripts/check-provider-coverage-set.ts",
    async (directory) => {
      const providers = await Promise.all(
        entries.map(async (entry, index) => {
          const input = join(directory, `${index}-${entry.provider}.json`)
          await Bun.write(input, JSON.stringify(entry.input))
          return { provider: entry.provider, input }
        })
      )
      const manifest = join(directory, "manifest.json")
      await Bun.write(manifest, JSON.stringify({ providers }))
      return ["--manifest", manifest, "--out", join(directory, "provider-coverage.json")]
    },
    async (directory): Promise<unknown> =>
      JSON.parse(await Bun.file(join(directory, "provider-coverage.json")).text())
  )
  return { exitCode: result.exitCode, json: result.output }
}

describe("provider ownership", () => {
  it("each module's curated datasets live on its own domain", () => {
    for (const { label, domain, datasets } of datasetGroups) {
      for (const dataset of Object.values(datasets)) {
        expect(dataset.domain, `${label} ${dataset.datasetId}`).toBe(domain)
      }
    }
  })

  it("a curated Socrata dataset is curated once", () => {
    const ids = datasetGroups.flatMap(({ datasets }) => datasetIds(datasets))
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([])
  })

  it("every direct feed is fetched over https from its provider's host", () => {
    for (const { label, host, feeds } of feedTables) {
      for (const [name, feed] of Object.entries(feeds)) {
        const url = new URL(feed.url)
        expect(`${url.protocol}//${url.host}`, `${label} ${name}`).toBe(`https://${host}`)
      }
    }
  })
})

describe("provider coverage", () => {
  it("passes when a snapshot lists exactly the curated datasets", async () => {
    const result = await runProviderCoverageCheck("mta-open-data", [
      { "Open Dataset ID": "f462-ka72", Name: "MTA Open Data Catalog" }
    ])
    expect(result.stderr.trim()).toBe("")
    expect(result.exitCode).toBe(0)
    expect(result.json).toMatchObject({
      provider: "mta-open-data",
      expectedCount: 1,
      localCount: 1,
      ok: true
    })
  })

  it("reports datasets the snapshot has and the kit lacks", async () => {
    const result = await runProviderCoverageCheck("mta-open-data", {
      rows: [{ "Open Dataset ID": "f462-ka72" }, { "Open Dataset ID": "abcd-1234" }]
    })
    expect(result.exitCode).toBe(1)
    expect(result.json).toMatchObject({
      provider: "mta-open-data",
      ok: false,
      missingIds: ["abcd-1234"]
    })
  })

  it("reports curated datasets missing from the snapshot", async () => {
    const result = await runProviderCoverageCheck("nyc-dot", [
      {
        resource: {
          id: "ycrg-ses3",
          name: "Bus Lanes - Local Streets",
          domain: "data.cityofnewyork.us"
        }
      }
    ])
    expect(result.exitCode).toBe(1)
    expect(result.json).toMatchObject({
      provider: "nyc-dot",
      ok: false,
      extraIds: ["btm5-ppia", "i4gi-tjb9"]
    })
  })

  it("checks direct MTA feeds by name, counting a shared name once", async () => {
    const result = await runProviderCoverageCheck("mta-direct", directFeeds)
    expect(result.exitCode).toBe(0)
    expect(result.json).toMatchObject({
      provider: "mta-direct",
      expectedCount: directFeedIds.length,
      localCount: directFeedIds.length,
      ok: true
    })
  })

  it("reports a direct feed the kit lacks and one the snapshot lacks", async () => {
    const missing = await runProviderCoverageCheck("mta-direct", [
      ...directFeeds,
      { id: "synthetic-missing-feed", url: "https://example.test/feed" }
    ])
    expect(missing.exitCode).toBe(1)
    expect(missing.json).toMatchObject({ ok: false, missingIds: ["synthetic-missing-feed"] })

    const extra = await runProviderCoverageCheck(
      "mta-direct",
      directFeeds.filter((feed) => feed.id !== "subway-regular")
    )
    expect(extra.exitCode).toBe(1)
    expect(extra.json).toMatchObject({ ok: false, extraIds: ["subway-regular"] })
  })

  it("writes release evidence for a set, also when a provider fails", async () => {
    const passing = await runProviderCoverageSet([{ provider: "mta-direct", input: directFeeds }])
    expect(passing.exitCode).toBe(0)
    expect(passing.json).toMatchObject({
      ok: true,
      generatedAt: expect.any(String),
      providers: [{ provider: "mta-direct", localCount: directFeedIds.length, ok: true }]
    })

    const failing = await runProviderCoverageSet([
      { provider: "mta-direct", input: [...directFeeds, { id: "synthetic-missing-feed" }] }
    ])
    expect(failing.exitCode).toBe(1)
    expect(failing.json).toMatchObject({
      ok: false,
      providers: [{ provider: "mta-direct", ok: false, missingIds: ["synthetic-missing-feed"] }]
    })
  })

  it("every coverage provider reads the kit's own lists", async () => {
    const local: Record<CoverageProvider, ReadonlyArray<string>> = {
      "nyc-open-data": datasetIds(NycOpenData.datasets),
      "nyc-dot": datasetIds(NycDot.datasets),
      "mta-open-data": datasetIds(MtaOpenData.datasets),
      "mta-direct": directFeedIds
    }
    for (const provider of coverageProviders) {
      const result = await runProviderCoverageCheck(
        provider,
        local[provider].map((id) => ({ id }))
      )
      expect(result.json, provider).toMatchObject({ provider, ok: true })
    }
  })
})
