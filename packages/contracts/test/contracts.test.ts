import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  ApiFamily,
  CliEnvelope,
  CliReleaseArtifact,
  CliReleaseManifest,
  CliSuccessEnvelope,
  DatasetDescriptorAdapterStatus,
  GtfsFeedKind,
  IsoDate,
  MtaElevatorEscalatorCurrent,
  MtaGtfsRealtimeCaptureManifest,
  MtaGtfsRealtimeCaptureRequest,
  MtaGtfsRealtimeCaptureResult,
  MtaGtfsRealtimeDecodedSummary,
  MtaGtfsRealtimeProbeResult,
  MtaJsonDirectFetchRequest,
  MtaJsonDirectFetchResult,
  MtaJsonDirectSurface,
  MtaOpenDataCatalogRow,
  MtaOpenDataDatasetDescriptor,
  makeDescriptorRegistry,
  NycDotBusLaneRow,
  NycDotDatasetDescriptor,
  NycDotDatasetName,
  NycOpenDataDatasetDescriptor,
  packageName,
  releaseVersion,
  SocrataDatasetId,
  SocrataDomain,
  Soda3CatalogSearchResponse,
  Soda3ExportRequest,
  Soda3Operation,
  Soda3QueryRequest,
  Soda3QueryResponse,
  schemaVersion
} from "../src/index"

describe("@nyc-transit-kit/contracts", () => {
  test("exposes initial schema contracts", () => {
    expect(packageName).toBe("@nyc-transit-kit/contracts")
    expect(releaseVersion).toBe("0.1.1")
    expect(schemaVersion).toBe("0.1.0")
    expect(ApiFamily).toBeDefined()
    expect(Soda3Operation).toBeDefined()
  })

  test("accepts every planned API family", () => {
    expect(Schema.is(ApiFamily)("socrata")).toBe(true)
    expect(Schema.is(ApiFamily)("mta")).toBe(true)
    expect(Schema.is(ApiFamily)("nyc-open-data")).toBe(true)
    expect(Schema.is(ApiFamily)("nyc-dot")).toBe(true)
  })

  test("rejects unknown API families", () => {
    expect(Schema.is(ApiFamily)("private-downstream")).toBe(false)
    expect(Schema.is(ApiFamily)("")).toBe(false)
  })

  test("accepts every SODA3 operation", () => {
    expect(Schema.is(Soda3Operation)("query")).toBe(true)
    expect(Schema.is(Soda3Operation)("export")).toBe(true)
    expect(Schema.is(Soda3Operation)("catalog")).toBe(true)
  })

  test("rejects SODA2-like operation names", () => {
    expect(Schema.is(Soda3Operation)("resource")).toBe(false)
    expect(Schema.is(Soda3Operation)("soda2")).toBe(false)
  })

  test("validates Socrata identifiers and domains", () => {
    expect(Schema.is(SocrataDatasetId)("abcd-1234")).toBe(true)
    expect(Schema.is(SocrataDatasetId)("abc-12345")).toBe(false)
    expect(Schema.is(SocrataDatasetId)("ABCD-1234")).toBe(false)
    expect(Schema.is(SocrataDomain)("data.cityofnewyork.us")).toBe(true)
    expect(Schema.is(SocrataDomain)("https://data.cityofnewyork.us")).toBe(false)
  })

  test("validates NYC DOT dataset name slugs", async () => {
    expect(Schema.is(NycDotDatasetName)("traffic-speeds")).toBe(true)
    expect(Schema.is(NycDotDatasetName)("DOT Traffic Speeds")).toBe(false)

    const dotDescriptor = await Effect.runPromise(
      Schema.decodeUnknownEffect(NycDotDatasetDescriptor)({
        name: "future-safety-counts",
        id: "abcd-1234",
        title: "Future Safety Counts",
        domain: "data.cityofnewyork.us",
        backing: "socrata"
      })
    )

    expect(String(dotDescriptor.name)).toBe("future-safety-counts")
  })

  test("builds descriptor registries with id and lookup keys", () => {
    const registry = makeDescriptorRegistry({
      descriptors: [
        { id: "one", name: "first" },
        { id: "two", name: "second" }
      ],
      id: (descriptor) => descriptor.id,
      lookupKeys: (descriptor) => [descriptor.name]
    })

    expect(registry.ids).toEqual(["one", "two"])
    expect(registry.findById("one")?.name).toBe("first")
    expect(registry.find("second")?.id).toBe("two")
  })

  test("rejects duplicate descriptor registry keys", () => {
    expect(() =>
      makeDescriptorRegistry({
        descriptors: [
          { id: "one", name: "first" },
          { id: "one", name: "other" }
        ],
        id: (descriptor) => descriptor.id,
        lookupKeys: (descriptor) => [descriptor.name]
      })
    ).toThrow("Duplicate descriptor id: one")

    expect(() =>
      makeDescriptorRegistry({
        descriptors: [
          { id: "one", name: "shared" },
          { id: "two", name: "shared" }
        ],
        id: (descriptor) => descriptor.id,
        lookupKeys: (descriptor) => [descriptor.name]
      })
    ).toThrow("Duplicate descriptor lookup key: shared")
  })

  test("validates ISO calendar dates", () => {
    expect(Schema.is(IsoDate)("2026-06-16")).toBe(true)
    expect(Schema.is(IsoDate)("2026-02-30")).toBe(false)
    expect(Schema.is(IsoDate)("06/16/2026")).toBe(false)
  })

  test("decodes SODA3 query and export request contracts", async () => {
    const query = await Effect.runPromise(
      Schema.decodeUnknownEffect(Soda3QueryRequest)({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234",
        query: "SELECT *",
        page: {
          pageNumber: 1,
          pageSize: 100
        },
        includeSynthetic: false
      })
    )

    const exportRequest = await Effect.runPromise(
      Schema.decodeUnknownEffect(Soda3ExportRequest)({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234",
        format: "csv",
        query: "SELECT *",
        range: {
          start: 0,
          end: 99
        }
      })
    )

    expect(query.query).toBe("SELECT *")
    expect(exportRequest.format).toBe("csv")
  })

  test("rejects invalid SODA3 request contracts", () => {
    expect(
      Schema.is(Soda3QueryRequest)({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234",
        select: "*"
      })
    ).toBe(false)

    expect(
      Schema.is(Soda3ExportRequest)({
        domain: "data.cityofnewyork.us",
        datasetId: "abcd-1234",
        format: "xml"
      })
    ).toBe(false)
  })

  test("decodes SODA3 response and catalog fragments", async () => {
    const queryResponse = await Effect.runPromise(
      Schema.decodeUnknownEffect(Soda3QueryResponse)({
        rows: [
          {
            station: "Canal St"
          }
        ],
        rowCount: 1
      })
    )

    const catalogResponse = await Effect.runPromise(
      Schema.decodeUnknownEffect(Soda3CatalogSearchResponse)({
        results: [
          {
            resource: {
              id: "abcd-1234",
              name: "Synthetic Transit Stations",
              domain: "data.cityofnewyork.us",
              type: "dataset"
            }
          }
        ],
        resultCount: 1
      })
    )

    expect(queryResponse.rowCount).toBe(1)
    expect(String(catalogResponse.results[0]?.resource.id)).toBe("abcd-1234")
  })

  test("validates CLI success and error envelopes", async () => {
    const successEnvelope = await Effect.runPromise(
      Schema.decodeUnknownEffect(CliSuccessEnvelope)({
        ok: true,
        data: {
          version: "0.0.0"
        },
        meta: {
          apiFamily: "cli",
          generatedAt: "1970-01-01T00:00:00.000Z",
          schemaVersion
        }
      })
    )

    const errorEnvelope = await Effect.runPromise(
      Schema.decodeUnknownEffect(CliEnvelope)({
        ok: false,
        error: {
          code: "unsupported-command",
          message: "Reserved command",
          retryable: false
        },
        meta: {
          apiFamily: "socrata",
          generatedAt: "1970-01-01T00:00:00.000Z",
          schemaVersion
        }
      })
    )

    expect(successEnvelope.ok).toBe(true)
    expect(errorEnvelope.ok).toBe(false)
  })

  test("decodes provider-family contracts", async () => {
    expect(Schema.is(GtfsFeedKind)("vehicle-positions")).toBe(true)
    expect(Schema.is(GtfsFeedKind)("bus-time")).toBe(false)
    expect(Schema.is(MtaJsonDirectSurface)("elevator-escalator")).toBe(true)
    expect(Schema.is(MtaJsonDirectSurface)("gtfs-realtime")).toBe(false)

    const mtaDescriptor = await Effect.runPromise(
      Schema.decodeUnknownEffect(MtaOpenDataDatasetDescriptor)({
        id: "f462-ka72",
        name: "MTA Open Data Catalog",
        domain: "data.ny.gov",
        backing: "socrata"
      })
    )
    const nycDescriptor = await Effect.runPromise(
      Schema.decodeUnknownEffect(NycOpenDataDatasetDescriptor)({
        id: "ycrg-ses3",
        name: "Bus Lanes - Local Streets",
        domain: "data.cityofnewyork.us",
        backing: "socrata",
        agency: "DOT"
      })
    )
    const dotDescriptor = await Effect.runPromise(
      Schema.decodeUnknownEffect(NycDotDatasetDescriptor)({
        name: "traffic-speeds",
        id: "i4gi-tjb9",
        title: "DOT Traffic Speeds",
        domain: "data.cityofnewyork.us",
        backing: "socrata",
        sourceUrl: "https://data.cityofnewyork.us/Transportation/DOT-Traffic-Speeds/i4gi-tjb9",
        tags: ["transportation", "traffic"],
        temporalFields: ["data_as_of"],
        adapterStatus: "row-schema",
        lastVerified: "2026-06-16"
      })
    )
    const realtimeSummary = MtaGtfsRealtimeDecodedSummary.make({
      feed: "vehicle-positions",
      entityCount: 3,
      tripUpdateCount: 1,
      vehiclePositionCount: 1,
      alertCount: 1,
      header: {
        gtfsRealtimeVersion: "2.0",
        timestamp: 123
      },
      raw: {}
    })
    const captureRequest = await Effect.runPromise(
      Schema.decodeUnknownEffect(MtaGtfsRealtimeCaptureRequest)({
        feed: "vehicle-positions",
        url: "https://api-endpoint.mta.info/realtime.pb?key=secret"
      })
    )
    const jsonDirectRequest = await Effect.runPromise(
      Schema.decodeUnknownEffect(MtaJsonDirectFetchRequest)({
        surface: "bus-time",
        url: "https://bustime.mta.info/api/siri/vehicle-monitoring.json",
        apiKey: "secret",
        query: {
          LineRef: "M15"
        }
      })
    )
    const jsonDirectResult = MtaJsonDirectFetchResult.make({
      surface: "elevator-escalator",
      status: 200,
      url: "https://api-endpoint.mta.info/feed.json?key=REDACTED",
      contentType: "application/json",
      json: [
        {
          station: "Example Station"
        }
      ]
    })
    const catalogRow = await Effect.runPromise(
      Schema.decodeUnknownEffect(MtaOpenDataCatalogRow)({
        "Open Dataset ID": "f462-ka72",
        Name: "MTA Open Data Catalog",
        Description: "Synthetic row"
      })
    )
    const elevatorRows = await Effect.runPromise(
      Schema.decodeUnknownEffect(MtaElevatorEscalatorCurrent)([
        {
          station: "Example Station",
          equipment: "EL001",
          equipmenttype: "EL"
        }
      ])
    )
    const captureManifest = MtaGtfsRealtimeCaptureManifest.make({
      feed: "vehicle-positions",
      status: 200,
      byteLength: 3,
      sha256: "0".repeat(64),
      capturedAt: "2026-06-16T00:00:00.000Z",
      url: "https://api-endpoint.mta.info/realtime.pb?key=REDACTED"
    })
    const captureResult = MtaGtfsRealtimeCaptureResult.make({
      feed: "vehicle-positions",
      status: 200,
      byteLength: 3,
      sha256: "0".repeat(64),
      capturedAt: "2026-06-16T00:00:00.000Z",
      url: "https://api-endpoint.mta.info/realtime.pb?key=REDACTED",
      bytes: new Uint8Array([1, 2, 3])
    })
    const probeResult = MtaGtfsRealtimeProbeResult.make({
      feed: "vehicle-positions",
      ok: true,
      status: 200,
      byteLength: 3,
      decoded: realtimeSummary
    })

    expect(String(mtaDescriptor.id)).toBe("f462-ka72")
    expect(captureRequest.feed).toBe("vehicle-positions")
    expect(jsonDirectRequest.apiKey).toBe("secret")
    expect(jsonDirectResult.json).toEqual([{ station: "Example Station" }])
    expect(catalogRow.Name).toBe("MTA Open Data Catalog")
    expect(elevatorRows[0]?.equipment).toBe("EL001")
    expect(Schema.is(MtaJsonDirectFetchResult)(jsonDirectResult)).toBe(true)
    expect(
      Schema.is(MtaJsonDirectFetchRequest)({
        surface: "gtfs-realtime",
        url: "https://api-endpoint.mta.info/feed.json"
      })
    ).toBe(false)
    expect(Schema.is(MtaGtfsRealtimeProbeResult)(probeResult)).toBe(true)
    expect(Schema.is(MtaGtfsRealtimeProbeResult)({ ...probeResult, byteLength: -1 })).toBe(false)
    expect(
      Schema.is(MtaGtfsRealtimeProbeResult)({
        ...probeResult,
        decoded: {
          feed: "vehicle-positions",
          entityCount: -1,
          tripUpdateCount: 0,
          vehiclePositionCount: 0,
          alertCount: 0,
          raw: {}
        }
      })
    ).toBe(false)
    expect(Schema.is(MtaGtfsRealtimeCaptureManifest)(captureManifest)).toBe(true)
    expect(Schema.is(MtaGtfsRealtimeCaptureResult)(captureResult)).toBe(true)
    expect(
      Schema.is(MtaGtfsRealtimeCaptureManifest)({
        ...captureManifest,
        sha256: "not-a-digest"
      })
    ).toBe(false)
    expect(Schema.is(MtaGtfsRealtimeDecodedSummary)(realtimeSummary)).toBe(true)
    expect(
      Schema.is(MtaGtfsRealtimeDecodedSummary)({
        feed: "vehicle-positions",
        entityCount: -1,
        tripUpdateCount: 0,
        vehiclePositionCount: 0,
        alertCount: 0,
        raw: {}
      })
    ).toBe(false)
    expect(String(nycDescriptor.domain)).toBe("data.cityofnewyork.us")
    expect(String(dotDescriptor.name)).toBe("traffic-speeds")
    expect(dotDescriptor.adapterStatus).toBe("row-schema")
    expect(String(dotDescriptor.lastVerified)).toBe("2026-06-16")
    expect(Schema.is(DatasetDescriptorAdapterStatus)("normalized")).toBe(true)
    expect(Schema.is(DatasetDescriptorAdapterStatus)("legacy")).toBe(false)
    expect(Schema.is(NycDotBusLaneRow)({ street: "Main St", borough: "Queens" })).toBe(false)
    expect(
      await Effect.runPromise(
        Schema.decodeUnknownEffect(NycDotBusLaneRow)({
          street: "Main St",
          borough: "Queens"
        })
      )
    ).toBeInstanceOf(NycDotBusLaneRow)
  })

  test("validates CLI release manifests", () => {
    const manifest = CliReleaseManifest.make({
      manifestVersion: 1,
      packageName: "@nyc-transit-kit/cli",
      version: "0.0.0",
      schemaVersion,
      schemaCommit: "0000000000000000000000000000000000000000",
      generatedSourceCommit: "0000000000000000000000000000000000000000",
      builtAt: "1970-01-01T00:00:00.000Z",
      artifacts: [
        CliReleaseArtifact.make({
          platform: "linux",
          arch: "x64",
          libc: "glibc",
          url: "file:///tmp/ntk",
          sha256: "0".repeat(64),
          size: 1,
          signed: false
        })
      ]
    })

    expect(Schema.is(CliReleaseManifest)(manifest)).toBe(true)
  })

  test("rejects unsupported CLI release artifact platforms", () => {
    expect(
      Schema.is(CliReleaseManifest)({
        manifestVersion: 1,
        packageName: "@nyc-transit-kit/cli",
        version: "0.0.0",
        schemaVersion,
        schemaCommit: "0000000000000000000000000000000000000000",
        generatedSourceCommit: "0000000000000000000000000000000000000000",
        builtAt: "1970-01-01T00:00:00.000Z",
        artifacts: [
          {
            platform: "freebsd",
            arch: "x64",
            url: "file:///tmp/ntk",
            sha256: "0".repeat(64),
            size: 1,
            signed: false
          }
        ]
      })
    ).toBe(false)
  })
})
