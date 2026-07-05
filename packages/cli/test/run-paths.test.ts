import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as BunServices from "@effect/platform-bun/BunServices"
import { CliEnvelope } from "@nyc-transit-kit/contracts/cli"
import { mtaLayer } from "@nyc-transit-kit/mta/client"
import { GtfsRealtimeDecoder } from "@nyc-transit-kit/mta/gtfs-realtime"
import { soda3Layer } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Command from "effect/unstable/cli/Command"
import { rootCommand } from "../src/commands/root"
import { CliCommandContext, packageVersion } from "../src/commands/shared"

type FetchStub = (request: Request) => Promise<Response>

const makeFetch = (fetchStub: FetchStub) => (input: string | URL | Request, init?: RequestInit) => {
  const request =
    input instanceof Request ? new Request(input, init) : new Request(input.toString(), init)
  return fetchStub(request)
}

const sampleSocrataCatalogResponse = {
  results: [
    {
      resource: {
        id: "abcd-1234",
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
        domain: "data.example.gov",
        rowLabel: "station"
      },
      permalink: "https://data.example.gov/d/abcd-1234",
      link: "https://data.example.gov/d/abcd-1234"
    }
  ],
  resultSetSize: 1,
  warnings: []
}

const sampleGtfsRealtimeFeedMessageBase64 =
  "CgUKAzIuMBIiCgd2ZWhpY2xlIhcKCAoGdHJpcC0xQgsKCXZlaGljbGUtMQ=="

const sampleGtfsRealtimeFeedMessageBytes = () =>
  Uint8Array.from(atob(sampleGtfsRealtimeFeedMessageBase64), (character) => character.charCodeAt(0))

const runInProcess = async (args: ReadonlyArray<string>, fetchStub: FetchStub) => {
  const outputs: Array<unknown> = []
  const previousExitCode = process.exitCode
  process.exitCode = 0

  const context = {
    runtime: {
      soda3Layer: soda3Layer({ fetch: makeFetch(fetchStub) }),
      mtaLayer: mtaLayer({ fetch: makeFetch(fetchStub) }),
      mtaRealtimeLayer: Layer.mergeAll(
        mtaLayer({ fetch: makeFetch(fetchStub) }),
        GtfsRealtimeDecoder.Live
      )
    },
    writeJson: (output: unknown) => {
      outputs.push(output)
    }
  }

  try {
    const exit = await Effect.runPromiseExit(
      Command.runWith(rootCommand, { version: packageVersion })(args).pipe(
        Effect.provideService(CliCommandContext, context),
        Effect.provide(BunServices.layer)
      )
    )
    const exitCode = process.exitCode
    return { outputs, exit, exitCode }
  } finally {
    process.exitCode = previousExitCode
  }
}

const decodeEnvelope = (output: unknown) =>
  Schema.decodeUnknownSync(CliEnvelope)(JSON.parse(JSON.stringify(output)))

const onlyOutput = (outputs: ReadonlyArray<unknown>) => {
  expect(outputs).toHaveLength(1)
  return outputs[0]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const expectRecord = (value: unknown) => {
  expect(isRecord(value)).toBe(true)
  if (!isRecord(value)) {
    throw new Error("Expected record")
  }
  return value
}

const expectSuccess = (output: unknown) => {
  const envelope = decodeEnvelope(output)
  expect(envelope.ok).toBe(true)
  if (!envelope.ok) {
    throw new Error("Expected success envelope")
  }
  return envelope
}

const expectFailure = (output: unknown) => {
  const envelope = decodeEnvelope(output)
  expect(envelope.ok).toBe(false)
  if (envelope.ok) {
    throw new Error("Expected failure envelope")
  }
  return envelope
}

const runWithRows = (args: ReadonlyArray<string>, requests: Array<Request>) =>
  runInProcess(args, async (request) => {
    requests.push(request)
    return Response.json({ rows: [{ a: 1 }] })
  })

describe("@nyc-transit-kit/cli run paths", () => {
  test("runs the in-process harness for a dry-run command", async () => {
    const result = await runInProcess(
      [
        "socrata",
        "query",
        "--domain",
        "data.example.gov",
        "--dataset",
        "abcd-1234",
        "--select",
        "*",
        "--json",
        "--dry-run"
      ],
      async () => Response.json({ rows: [] })
    )
    const envelope = expectSuccess(onlyOutput(result.outputs))
    const data = expectRecord(envelope.data)

    expect(result.exit._tag).toBe("Success")
    expect(result.exitCode).toBe(0)
    expect(data.dryRun).toBe(true)
  })

  test("runs Socrata query and captures the provider request", async () => {
    const requests: Array<Request> = []
    const result = await runWithRows(
      [
        "socrata",
        "query",
        "--domain",
        "data.example.gov",
        "--dataset",
        "abcd-1234",
        "--select",
        "*",
        "--json"
      ],
      requests
    )
    const envelope = expectSuccess(onlyOutput(result.outputs))
    const data = expectRecord(envelope.data)

    expect(result.exitCode).toBe(0)
    expect(envelope.meta.apiFamily).toBe("socrata")
    expect(data.rows).toEqual([{ a: 1 }])
    expect(requests[0]?.method).toBe("POST")
    expect(requests[0]?.url).toBe("https://data.example.gov/api/v3/views/abcd-1234/query.json")
  })

  test("runs Socrata catalog search through the Discovery API", async () => {
    const requests: Array<Request> = []
    const result = await runInProcess(
      ["catalog", "search", "--domain", "data.example.gov", "--query", "transit", "--json"],
      async (request) => {
        requests.push(request)
        return Response.json(sampleSocrataCatalogResponse)
      }
    )
    const envelope = expectSuccess(onlyOutput(result.outputs))
    const data = expectRecord(envelope.data)

    expect(envelope.meta.apiFamily).toBe("socrata")
    expect(Array.isArray(data.results) ? data.results.length : 0).toBeGreaterThan(0)
    expect(requests[0] === undefined ? undefined : new URL(requests[0].url).host).toBe(
      "api.us.socrata.com"
    )
  })

  test("runs NYC Open Data dataset query against the fixed domain", async () => {
    const requests: Array<Request> = []
    const result = await runWithRows(
      ["nyc-open-data", "dataset", "query", "--dataset", "ycrg-ses3", "--select", "*", "--json"],
      requests
    )
    const envelope = expectSuccess(onlyOutput(result.outputs))

    expect(envelope.meta.apiFamily).toBe("nyc-open-data")
    expect(requests[0] === undefined ? undefined : new URL(requests[0].url).host).toBe(
      "data.cityofnewyork.us"
    )
  })

  test("runs NYC DOT dataset query through the curated descriptor", async () => {
    const requests: Array<Request> = []
    const result = await runWithRows(
      ["nyc-dot", "dataset", "query", "--name", "traffic-speeds", "--select", "*", "--json"],
      requests
    )
    const envelope = expectSuccess(onlyOutput(result.outputs))

    expect(envelope.meta.apiFamily).toBe("nyc-dot")
    expect(requests[0]?.url).toContain("/api/v3/views/i4gi-tjb9/query.json")
  })

  test("runs MTA Open Data query through SODA3", async () => {
    const requests: Array<Request> = []
    const result = await runWithRows(
      ["mta", "open-data", "dataset", "query", "--dataset", "f462-ka72", "--select", "*", "--json"],
      requests
    )
    const envelope = expectSuccess(onlyOutput(result.outputs))

    expect(envelope.meta.apiFamily).toBe("mta")
    expect(requests[0] === undefined ? undefined : new URL(requests[0].url).host).toBe(
      "data.ny.gov"
    )
  })

  test("runs MTA GTFS realtime probe and decodes the fixture bytes", async () => {
    const result = await runInProcess(
      ["mta", "gtfs-rt", "probe", "--feed", "alerts-all", "--json"],
      async () => new Response(sampleGtfsRealtimeFeedMessageBytes(), { status: 200 })
    )
    const envelope = expectSuccess(onlyOutput(result.outputs))
    const data = expectRecord(envelope.data)
    const decoded = expectRecord(data.decoded)

    expect(envelope.meta.apiFamily).toBe("mta")
    expect(data.feed).toBe("alerts")
    expect(decoded.entityCount).toBe(1)
  })

  test("writes typed HTTP failures as JSON envelopes and exit code 1", async () => {
    const result = await runInProcess(
      [
        "socrata",
        "query",
        "--domain",
        "data.example.gov",
        "--dataset",
        "abcd-1234",
        "--select",
        "*",
        "--json"
      ],
      async () => new Response("nope", { status: 500 })
    )
    const envelope = expectFailure(onlyOutput(result.outputs))

    expect(result.exitCode).toBe(1)
    expect(envelope.error.code).toBe("provider-http-error")
    // Current TaggedErrorClass behavior: no declared message field means empty message.
    expect(envelope.error.message).toBe("")
    expect(envelope.error.command).toBe("socrata query")
  })

  test("writes NYC DOT unsupported dataset errors without fetching", async () => {
    const requests: Array<Request> = []
    const result = await runInProcess(
      ["nyc-dot", "dataset", "query", "--name", "unknown-name", "--select", "*", "--json"],
      async (request) => {
        requests.push(request)
        return Response.json({ rows: [] })
      }
    )
    const envelope = expectFailure(onlyOutput(result.outputs))

    expect(requests).toHaveLength(0)
    expect(result.exitCode).toBe(1)
    expect(envelope.error.code).toBe("unsupported-dataset")
    expect(envelope.error.message).toBe("Unsupported NYC DOT dataset: unknown-name")
  })

  test("requires manual URL for generic MTA realtime feed kinds", async () => {
    const result = await runInProcess(
      ["mta", "gtfs-rt", "probe", "--feed", "vehicle-positions", "--json"],
      async () => Response.json({})
    )
    const envelope = expectFailure(onlyOutput(result.outputs))

    expect(result.exitCode).toBe(1)
    expect(envelope.error.code).toBe("missing-option")
    expect(envelope.error.message).toContain("--url")
  })

  test("writes invalid Socrata input errors as JSON envelopes", async () => {
    const result = await runInProcess(
      [
        "socrata",
        "query",
        "--domain",
        "data.example.gov",
        "--dataset",
        "not!valid",
        "--select",
        "*",
        "--json"
      ],
      async () => Response.json({ rows: [] })
    )
    const envelope = expectFailure(onlyOutput(result.outputs))

    expect(result.exitCode).toBe(1)
    expect(envelope.error.code).toBe("invalid-input-error")
  })

  test("downloads Socrata exports to a file with response metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ntk-cli-"))
    const output = join(directory, "rows.csv")

    try {
      const result = await runInProcess(
        [
          "socrata",
          "export",
          "--domain",
          "data.example.gov",
          "--dataset",
          "abcd-1234",
          "--format",
          "csv",
          "--output",
          output,
          "--json"
        ],
        async () =>
          new Response("a,b\n1,2\n", {
            status: 200,
            headers: {
              "content-type": "text/csv"
            }
          })
      )
      const envelope = expectSuccess(onlyOutput(result.outputs))
      const data = expectRecord(envelope.data)

      expect(data.output).toBe(output)
      expect(data.byteLength).toBe(8)
      expect(data.contentType).toBe("text/csv")
      expect(await readFile(output, "utf8")).toBe("a,b\n1,2\n")
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("downloads MTA GTFS static files with response metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ntk-cli-"))
    const output = join(directory, "gtfs.zip")

    try {
      const result = await runInProcess(
        [
          "mta",
          "gtfs-static",
          "fetch",
          "--feed",
          "subway-regular",
          "--url",
          "https://example.test/gtfs.zip",
          "--output",
          output,
          "--json"
        ],
        async () =>
          new Response("zip-bytes", {
            status: 200,
            headers: {
              "content-type": "application/zip",
              "content-length": "9"
            }
          })
      )
      const envelope = expectSuccess(onlyOutput(result.outputs))
      const data = expectRecord(envelope.data)

      expect(data.output).toBe(output)
      expect(data.status).toBe(200)
      expect(data.byteLength).toBe(9)
      expect(data.contentType).toBe("application/zip")
      expect(data.contentLength).toBe(9)
      expect(await readFile(output, "utf8")).toBe("zip-bytes")
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("captures MTA GTFS realtime bytes and a manifest", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ntk-cli-"))
    const output = join(directory, "feed.pb")
    const manifestOutput = join(directory, "manifest.json")
    const bytes = sampleGtfsRealtimeFeedMessageBytes()

    try {
      const result = await runInProcess(
        [
          "mta",
          "gtfs-rt",
          "capture",
          "--feed",
          "alerts-all",
          "--output",
          output,
          "--manifest-output",
          manifestOutput,
          "--json"
        ],
        async () => new Response(bytes, { status: 200 })
      )
      const envelope = expectSuccess(onlyOutput(result.outputs))
      const data = expectRecord(envelope.data)
      const manifest = expectRecord(data.manifest)
      const manifestFile = expectRecord(JSON.parse(await readFile(manifestOutput, "utf8")))
      const written = await readFile(output)

      expect(data.output).toBe(output)
      expect(data.manifestOutput).toBe(manifestOutput)
      expect(written.byteLength).toBe(bytes.byteLength)
      expect(manifest.byteLength).toBe(bytes.byteLength)
      expect(manifestFile.sha256).toBe(manifest.sha256)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
