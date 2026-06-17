import { describe, expect, test } from "bun:test"
import { releaseVersion } from "@nyc-transit-kit/contracts/metadata"
import { localBinaryName, packageName } from "../src/index"

const cliEntrypoint = new URL("../src/main.ts", import.meta.url).pathname

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const expectJson = (result: Awaited<ReturnType<typeof runCli>>) => {
  expect(result.stdout.trim().startsWith("{")).toBe(true)
  expect(result.json).not.toBeUndefined()
  return result.json
}

const expectHumanOutput = (result: Awaited<ReturnType<typeof runCli>>) => {
  expect(result.stdout.trim().startsWith("{")).toBe(false)
  expect(result.json).toBeUndefined()
  return result.stdout
}

const expectGeneratedAt = (json: unknown) => {
  const meta = isRecord(json) ? json.meta : undefined
  const generatedAt = isRecord(meta) ? meta.generatedAt : undefined

  expect(typeof generatedAt).toBe("string")
  if (typeof generatedAt !== "string") {
    return
  }

  expect(Number.isNaN(Date.parse(generatedAt))).toBe(false)
  expect(generatedAt).not.toBe("1970-01-01T00:00:00.000Z")
}

const runCli = async (args: ReadonlyArray<string>) => {
  const proc = Bun.spawn(["bun", "run", cliEntrypoint, ...args], {
    stderr: "pipe",
    stdout: "pipe"
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  const json: unknown = stdout.trim().startsWith("{") ? JSON.parse(stdout) : undefined

  return {
    exitCode,
    json,
    stderr,
    stdout
  }
}

describe("@nyc-transit-kit/cli", () => {
  test("declares local binary placeholders", () => {
    expect(packageName).toBe("@nyc-transit-kit/cli")
    expect(localBinaryName).toBe("ntk")
  })

  test("prints version JSON for the stable scaffold command", async () => {
    const result = await runCli(["--version", "--json"])
    const json = expectJson(result)

    expect(result.exitCode).toBe(0)
    expect(isRecord(json) ? json.ok : undefined).toBe(true)

    const data = isRecord(json) ? json.data : undefined
    expect(isRecord(data) ? data.binary : undefined).toBe("ntk")
    expect(isRecord(data) ? data.version : undefined).toBe(releaseVersion)
    expect(isRecord(data) ? data.schemaVersion : undefined).toBe("0.1.0")
    expect(isRecord(data) ? data.commit : undefined).toBe("unknown")
    expect(isRecord(data) ? data.buildTarget : undefined).toBe("source")
    expectGeneratedAt(json)
  })

  test("prints version JSON when --json appears before --version", async () => {
    const result = await runCli(["--json", "--version"])
    const json = expectJson(result)

    expect(result.exitCode).toBe(0)
    expect(isRecord(json) ? json.ok : undefined).toBe(true)

    const data = isRecord(json) ? json.data : undefined
    expect(isRecord(data) ? data.binary : undefined).toBe("ntk")
    expect(isRecord(data) ? data.version : undefined).toBe(releaseVersion)
    expect(isRecord(data) ? data.schemaVersion : undefined).toBe("0.1.0")
    expect(isRecord(data) ? data.commit : undefined).toBe("unknown")
    expect(isRecord(data) ? data.buildTarget : undefined).toBe("source")
  })

  test("prints human version output", async () => {
    const result = await runCli(["--version"])
    const stdout = expectHumanOutput(result)

    expect(result.exitCode).toBe(0)
    expect(stdout).toContain("ntk")
    expect(stdout).toContain(releaseVersion)
  })

  test("prints root help as human output", async () => {
    const result = await runCli(["--help"])
    const stdout = expectHumanOutput(result)

    expect(result.exitCode).toBe(0)
    expect(stdout).toContain("socrata")
    expect(stdout).toContain("catalog")
    expect(stdout).toContain("mta")
    expect(stdout).toContain("nyc-open-data")
    expect(stdout).toContain("nyc-dot")
    expect(stdout).toContain("--json")
    expect(stdout).toContain("stable JSON envelope")
  })

  test("prints subcommand help as human output", async () => {
    const result = await runCli(["socrata", "query", "--help"])
    const stdout = expectHumanOutput(result)

    expect(result.exitCode).toBe(0)
    expect(stdout).toContain("--domain")
    expect(stdout).toContain("--dataset")
    expect(stdout).toContain("--select")
    expect(stdout).toContain("Socrata domain without protocol")
    expect(stdout).toContain("Socrata dataset id")
    expect(stdout).toContain("SoQL select expression")
    expect(stdout).toContain("without contacting the provider")
  })

  test("prints MTA realtime probe help as human output", async () => {
    const result = await runCli(["mta", "gtfs-rt", "probe", "--help"])
    const stdout = expectHumanOutput(result)

    expect(result.exitCode).toBe(0)
    expect(stdout).toContain("--feed")
    expect(stdout).toContain("--url")
    expect(stdout).toContain("Known feed id/name")
    expect(stdout).toContain("Manual provider URL override")
  })

  test("fails unknown commands instead of reporting scaffold success", async () => {
    const result = await runCli(["definitely-not-a-command", "--json"])
    const json = expectJson(result)

    expect(result.exitCode).toBe(1)
    expect(isRecord(json) ? json.ok : undefined).toBe(false)

    const error = isRecord(json) ? json.error : undefined
    expect(isRecord(error) ? error.code : undefined).toBe("unknown-command")
    expectGeneratedAt(json)
  })

  test("fails reserved commands with missing required options", async () => {
    const result = await runCli(["socrata", "query", "--json"])
    const json = expectJson(result)

    expect(result.exitCode).toBe(1)
    expect(isRecord(json) ? json.ok : undefined).toBe(false)

    const error = isRecord(json) ? json.error : undefined
    expect(isRecord(error) ? error.code : undefined).toBe("missing-option")
    expect(isRecord(error) ? error.command : undefined).toBe("socrata query")
  })

  test("renders Socrata query dry-run JSON", async () => {
    const result = await runCli([
      "socrata",
      "query",
      "--domain",
      "data.cityofnewyork.us",
      "--dataset",
      "ycrg-ses3",
      "--select",
      "*",
      "--json",
      "--dry-run"
    ])

    expect(result.exitCode).toBe(0)
    const json = expectJson(result)
    const data = isRecord(json) ? json.data : undefined
    expect(isRecord(data) ? data.url : undefined).toBe(
      "https://data.cityofnewyork.us/api/v3/views/ycrg-ses3/query.json"
    )
    expectGeneratedAt(json)
  })

  test("renders Socrata range probe dry-run JSON", async () => {
    const result = await runCli([
      "socrata",
      "range-probe",
      "--domain",
      "data.ny.gov",
      "--dataset",
      "f462-ka72",
      "--format",
      "csv",
      "--range-end",
      "63",
      "--json",
      "--dry-run"
    ])

    expect(result.exitCode).toBe(0)
    const data = isRecord(result.json) ? result.json.data : undefined
    const headers = isRecord(data) ? data.headers : undefined
    expect(isRecord(headers) ? headers.range : undefined).toBe("bytes=0-63")
  })

  test("renders Socrata export dry-run JSON", async () => {
    const result = await runCli([
      "socrata",
      "export",
      "--domain",
      "data.cityofnewyork.us",
      "--dataset",
      "ycrg-ses3",
      "--format",
      "csv",
      "--output",
      "/tmp/ntk-export.csv",
      "--json",
      "--dry-run"
    ])

    expect(result.exitCode).toBe(0)
    const data = isRecord(result.json) ? result.json.data : undefined
    expect(isRecord(data) ? data.url : undefined).toBe(
      "https://data.cityofnewyork.us/api/v3/views/ycrg-ses3/export.csv"
    )
  })

  test("renders catalog search dry-run JSON", async () => {
    const result = await runCli([
      "catalog",
      "search",
      "--domain",
      "data.cityofnewyork.us",
      "--query",
      "bus lanes",
      "--json",
      "--dry-run"
    ])

    expect(result.exitCode).toBe(0)
    const data = isRecord(result.json) ? result.json.data : undefined
    expect(isRecord(data) ? data.url : undefined).toContain("api.us.socrata.com/api/catalog/v1")
  })

  test("renders MTA static fetch dry-run JSON", async () => {
    const result = await runCli([
      "mta",
      "gtfs-static",
      "fetch",
      "--url",
      "https://new.mta.info/feed.zip",
      "--output",
      "/tmp/mta-feed.zip",
      "--json",
      "--dry-run"
    ])

    expect(result.exitCode).toBe(0)
    const data = isRecord(result.json) ? result.json.data : undefined
    expect(isRecord(data) ? data.method : undefined).toBe("GET")
  })

  test("renders MTA realtime probe dry-run JSON", async () => {
    const result = await runCli([
      "mta",
      "gtfs-rt",
      "probe",
      "--feed",
      "subway-1234567",
      "--json",
      "--dry-run"
    ])

    expect(result.exitCode).toBe(0)
    const data = isRecord(result.json) ? result.json.data : undefined
    const descriptor = isRecord(data) ? data.descriptor : undefined
    expect(isRecord(data) ? data.feed : undefined).toBe("trip-updates")
    expect(isRecord(descriptor) ? descriptor.id : undefined).toBe("subway-1234567")
  })

  test("renders NYC Open Data generic command dry-runs", async () => {
    const catalog = await runCli([
      "nyc-open-data",
      "catalog",
      "search",
      "--query",
      "bus lanes",
      "--limit",
      "5",
      "--json",
      "--dry-run"
    ])
    const list = await runCli(["nyc-open-data", "dataset", "list", "--json"])
    const query = await runCli([
      "nyc-open-data",
      "dataset",
      "query",
      "--dataset",
      "ycrg-ses3",
      "--select",
      "*",
      "--json",
      "--dry-run"
    ])
    const exportResult = await runCli([
      "nyc-open-data",
      "dataset",
      "export",
      "--dataset",
      "ycrg-ses3",
      "--format",
      "csv",
      "--output",
      "/tmp/nyc-open-data.csv",
      "--json",
      "--dry-run"
    ])

    expect(catalog.exitCode).toBe(0)
    expect(list.exitCode).toBe(0)
    expect(query.exitCode).toBe(0)
    expect(exportResult.exitCode).toBe(0)

    const catalogData = isRecord(catalog.json) ? catalog.json.data : undefined
    const listData = isRecord(list.json) ? list.json.data : undefined
    const queryData = isRecord(query.json) ? query.json.data : undefined
    const exportData = isRecord(exportResult.json) ? exportResult.json.data : undefined
    expect(isRecord(catalogData) ? catalogData.url : undefined).toContain(
      "api.us.socrata.com/api/catalog/v1"
    )
    expect(Array.isArray(isRecord(listData) ? listData.datasets : undefined)).toBe(true)
    expect(isRecord(queryData) ? queryData.url : undefined).toBe(
      "https://data.cityofnewyork.us/api/v3/views/ycrg-ses3/query.json"
    )
    expect(isRecord(exportData) ? exportData.url : undefined).toBe(
      "https://data.cityofnewyork.us/api/v3/views/ycrg-ses3/export.csv"
    )
  })

  test("renders NYC DOT generic command dry-runs", async () => {
    const list = await runCli(["nyc-dot", "dataset", "list", "--json"])
    const query = await runCli([
      "nyc-dot",
      "dataset",
      "query",
      "--name",
      "traffic-speeds",
      "--select",
      "*",
      "--json",
      "--dry-run"
    ])
    const exportResult = await runCli([
      "nyc-dot",
      "dataset",
      "export",
      "--name",
      "traffic-speeds",
      "--format",
      "csv",
      "--output",
      "/tmp/nyc-dot.csv",
      "--json",
      "--dry-run"
    ])

    expect(list.exitCode).toBe(0)
    expect(query.exitCode).toBe(0)
    expect(exportResult.exitCode).toBe(0)

    const listData = isRecord(list.json) ? list.json.data : undefined
    const queryData = isRecord(query.json) ? query.json.data : undefined
    const exportData = isRecord(exportResult.json) ? exportResult.json.data : undefined
    expect(Array.isArray(isRecord(listData) ? listData.datasets : undefined)).toBe(true)
    expect(isRecord(queryData) ? queryData.url : undefined).toBe(
      "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9/query.json"
    )
    expect(isRecord(exportData) ? exportData.url : undefined).toBe(
      "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9/export.csv"
    )
  })

  test("renders MTA Open Data and direct feed command dry-runs", async () => {
    const openDataList = await runCli(["mta", "open-data", "dataset", "list", "--json"])
    const openDataQuery = await runCli([
      "mta",
      "open-data",
      "dataset",
      "query",
      "--dataset",
      "f462-ka72",
      "--select",
      "*",
      "--json",
      "--dry-run"
    ])
    const staticList = await runCli(["mta", "gtfs-static", "list", "--json"])
    const staticProbe = await runCli([
      "mta",
      "gtfs-static",
      "probe",
      "--feed",
      "subway-regular",
      "--json",
      "--dry-run"
    ])
    const realtimeList = await runCli(["mta", "gtfs-rt", "list", "--json"])
    const realtimeDecode = await runCli([
      "mta",
      "gtfs-rt",
      "decode",
      "--feed",
      "alerts-all",
      "--json",
      "--dry-run"
    ])
    const realtimeCapture = await runCli([
      "mta",
      "gtfs-rt",
      "capture",
      "--feed",
      "alerts-all",
      "--output",
      "/tmp/alerts.pb",
      "--manifest-output",
      "/tmp/alerts.manifest.json",
      "--json",
      "--dry-run"
    ])

    expect(openDataList.exitCode).toBe(0)
    expect(openDataQuery.exitCode).toBe(0)
    expect(staticList.exitCode).toBe(0)
    expect(staticProbe.exitCode).toBe(0)
    expect(realtimeList.exitCode).toBe(0)
    expect(realtimeDecode.exitCode).toBe(0)
    expect(realtimeCapture.exitCode).toBe(0)

    const openDataListData = isRecord(openDataList.json) ? openDataList.json.data : undefined
    const openDataQueryData = isRecord(openDataQuery.json) ? openDataQuery.json.data : undefined
    const staticListData = isRecord(staticList.json) ? staticList.json.data : undefined
    const staticProbeData = isRecord(staticProbe.json) ? staticProbe.json.data : undefined
    const realtimeListData = isRecord(realtimeList.json) ? realtimeList.json.data : undefined
    const realtimeDecodeData = isRecord(realtimeDecode.json) ? realtimeDecode.json.data : undefined
    const realtimeCaptureData = isRecord(realtimeCapture.json)
      ? realtimeCapture.json.data
      : undefined

    expect(Array.isArray(isRecord(openDataListData) ? openDataListData.datasets : undefined)).toBe(
      true
    )
    expect(isRecord(openDataQueryData) ? openDataQueryData.url : undefined).toBe(
      "https://data.ny.gov/api/v3/views/f462-ka72/query.json"
    )
    expect(Array.isArray(isRecord(staticListData) ? staticListData.feeds : undefined)).toBe(true)
    expect(isRecord(staticProbeData) ? staticProbeData.url : undefined).toBe(
      "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip"
    )
    expect(Array.isArray(isRecord(realtimeListData) ? realtimeListData.feeds : undefined)).toBe(
      true
    )
    expect(isRecord(realtimeDecodeData) ? realtimeDecodeData.feed : undefined).toBe("alerts")
    expect(isRecord(realtimeCaptureData) ? realtimeCaptureData.feed : undefined).toBe("alerts")
    expect(isRecord(realtimeCaptureData) ? realtimeCaptureData.output : undefined).toBe(
      "/tmp/alerts.pb"
    )
    expect(isRecord(realtimeCaptureData) ? realtimeCaptureData.manifestOutput : undefined).toBe(
      "/tmp/alerts.manifest.json"
    )
  })

  test("returns provider-scoped JSON errors for invalid dry-run input", async () => {
    const result = await runCli([
      "nyc-dot",
      "dataset",
      "query",
      "--name",
      "unknown",
      "--select",
      "*",
      "--json",
      "--dry-run"
    ])
    const json = expectJson(result)
    const error = isRecord(json) ? json.error : undefined
    const meta = isRecord(json) ? json.meta : undefined

    expect(result.exitCode).toBe(1)
    expect(isRecord(error) ? error.code : undefined).toBe("unsupported-dataset")
    expect(isRecord(meta) ? meta.apiFamily : undefined).toBe("nyc-dot")
  })

  test("renders provider dataset info JSON", async () => {
    const openData = await runCli([
      "nyc-open-data",
      "dataset",
      "info",
      "--dataset",
      "ycrg-ses3",
      "--json"
    ])
    const dot = await runCli(["nyc-dot", "dataset", "info", "--name", "traffic-speeds", "--json"])

    expect(openData.exitCode).toBe(0)
    expect(dot.exitCode).toBe(0)

    const openDataData = isRecord(openData.json) ? openData.json.data : undefined
    const dotData = isRecord(dot.json) ? dot.json.data : undefined
    expect(isRecord(openDataData) ? openDataData.known : undefined).toBe(true)
    expect(isRecord(dotData) ? dotData.name : undefined).toBe("traffic-speeds")
  })

  test("keeps provider command handlers out of the entrypoint", async () => {
    const mainSource = await Bun.file(new URL("../src/main.ts", import.meta.url)).text()

    expect(mainSource).not.toContain("handleSocrataQuery")
    expect(mainSource).not.toContain("handleMtaGtfsRealtimeProbe")
  })

  test("keeps Socrata command definitions in the Socrata command module", async () => {
    const source = await Bun.file(new URL("../src/commands/socrata.ts", import.meta.url)).text()

    expect(source).toContain('["socrata", "query"]')
    expect(source).toContain("handleSocrataQuery")
  })

  test("uses the live MTA realtime decoder at the CLI edge", async () => {
    const source = await Bun.file(new URL("../src/config.ts", import.meta.url)).text()

    expect(source).toContain("GtfsRealtimeDecoder.Live")
    expect(source).not.toContain("GtfsRealtimeDecoder.Passthrough")
  })

  test("keeps file write errors in the shared SODA command helper", async () => {
    const commandFiles = [
      "socrata.ts",
      "nyc-open-data.ts",
      "nyc-dot.ts",
      "mta.ts"
    ] satisfies ReadonlyArray<string>
    const offenders: Array<string> = []

    for (const file of commandFiles) {
      const source = await Bun.file(new URL(`../src/commands/${file}`, import.meta.url)).text()
      if (source.includes("const fileWriteError =")) {
        offenders.push(file)
      }
    }

    const sharedSource = await Bun.file(
      new URL("../src/commands/soda3-shared.ts", import.meta.url)
    ).text()

    expect(sharedSource).toContain("const fileWriteError =")
    expect(offenders).toEqual([])
  })
})
