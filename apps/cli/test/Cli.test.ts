import * as BunServices from "@effect/platform-bun/BunServices"
import { describe, expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as GtfsRealtime from "@nyc-transit-kit/mta/GtfsRealtime"
import * as ConfigProvider from "effect/ConfigProvider"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import * as Sink from "effect/Sink"
import * as Stdio from "effect/Stdio"
import * as TestClock from "effect/testing/TestClock"
import * as TestConsole from "effect/testing/TestConsole"
import * as BuildInfo from "../src/BuildInfo"
import * as Cli from "../src/Cli"
import { Envelope, schemaVersion } from "../src/Envelope"

interface Ran {
  readonly exit: Exit.Exit<unknown, unknown>
  readonly stdout: string
  readonly logs: ReadonlyArray<unknown>
  readonly errors: ReadonlyArray<unknown>
}

const decoder = new TextDecoder()

/**
 * One run of the real CLI. The test owns stdout, the Console, the environment
 * and the network; files and everything else are Bun's.
 */
const ntk = (args: ReadonlyArray<string>, env: Readonly<Record<string, string>> = {}) =>
  Effect.gen(function* () {
    const stdout = yield* Ref.make("")
    const stdio = Stdio.layerTest({
      args: Effect.succeed(args),
      stdout: () =>
        // biome-ignore lint/suspicious/useIterableCallbackReturn: Sink.forEach runs the Effect each chunk returns.
        Sink.forEach((chunk: string | Uint8Array) =>
          Ref.update(
            stdout,
            (text) => text + (typeof chunk === "string" ? chunk : decoder.decode(chunk))
          )
        )
    })
    const exit = yield* Effect.exit(Effect.provide(Cli.run(args), stdio))
    const ran: Ran = {
      exit,
      stdout: yield* Ref.get(stdout),
      logs: yield* TestConsole.logLines,
      errors: yield* TestConsole.errorLines
    }
    return ran
  }).pipe(
    Effect.provide(
      Layer.mergeAll(TestConsole.layer, ConfigProvider.layer(ConfigProvider.fromEnv({ env })))
    )
  )

/** The network a test allows. By default there is none: any request is a defect. */
const world = (network = HttpTest.layer(() => Effect.die("no network in tests"))) =>
  Layer.mergeAll(network, BunServices.layer)

const decodeEnvelope = Schema.decodeUnknownEffect(Schema.fromJsonString(Envelope))

/** The run's one envelope. Anything else on stdout fails the test. */
const envelope = (ran: Ran) => {
  const lines = ran.stdout.split("\n").filter((line) => line !== "")
  expect(lines).toHaveLength(1)
  return decodeEnvelope(lines[0])
}

const dataOf = (result: Envelope) => (result.ok ? result.data : undefined)

const token = ["--app-token", "test-token"]
const speeds = ["--domain", "data.cityofnewyork.us", "--dataset", "i4gi-tjb9"]
const select = ["--select", "* LIMIT 2"]
const sir = ["--feed", "staten-island-railway"]
const sirUrl = GtfsRealtime.feeds["staten-island-railway"].url

/** Yields until the network has seen `count` requests. */
const requestsReach = Effect.fnUntraced(function* (count: number) {
  for (let turn = 0; turn < 10_000; turn++) {
    if ((yield* HttpTest.requests).length >= count) return
    yield* Effect.yieldNow
  }
  return yield* Effect.die(`the CLI never sent request ${count}`)
})

describe("version and help", () => {
  it.effect("--version prints the version", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["--version"])
      expect(ran.logs).toEqual([`ntk ${BuildInfo.version}`])
      expect(ran.stdout).toBe("")
      expect(Exit.isSuccess(ran.exit)).toBe(true)
    }).pipe(Effect.provide(world()))
  )

  it.effect("--version --json answers with an envelope stamped by the clock", () =>
    Effect.gen(function* () {
      const now = DateTime.makeUnsafe("2026-11-01T12:00:00Z")
      yield* TestClock.setTime(DateTime.toEpochMillis(now))
      const result = yield* envelope(yield* ntk(["--json", "--version"]))
      expect(result).toMatchObject({
        ok: true,
        data: {
          binary: "ntk",
          version: BuildInfo.version,
          schemaVersion,
          commit: "unknown",
          buildTarget: "source"
        },
        meta: { apiFamily: "cli", schemaVersion }
      })
      expect(DateTime.formatIso(result.meta.generatedAt)).toBe("2026-11-01T12:00:00.000Z")
    }).pipe(Effect.provide(world()))
  )

  it.effect("--help prints readable help", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["--help"])
      const help = ran.logs.join("\n")
      for (const word of [
        "socrata",
        "catalog",
        "mta",
        "nyc-open-data",
        "nyc-dot",
        "--json",
        "--dry-run"
      ]) {
        expect(help).toContain(word)
      }
      expect(ran.stdout).toBe("")
    }).pipe(Effect.provide(world()))
  )

  it.effect("with --json, help arrives inside the envelope", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["mta", "gtfs-rt", "probe", "--help", "--json"])
      expect(yield* envelope(ran)).toMatchObject({
        ok: true,
        data: { help: expect.stringContaining("ntk mta gtfs-rt probe") },
        meta: { apiFamily: "mta" }
      })
      expect(ran.logs).toEqual([])
    }).pipe(Effect.provide(world()))
  )
})

describe("errors", () => {
  it.effect("a missing token is one missing-option envelope and nothing else", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["--json", "socrata", "query", ...speeds, ...select])
      expect(yield* envelope(ran)).toMatchObject({
        ok: false,
        error: {
          code: "missing-option",
          message: "Missing required flag: --app-token, or set SOCRATA_APP_TOKEN"
        },
        meta: { apiFamily: "socrata" }
      })
      expect(Exit.isFailure(ran.exit)).toBe(true)
      expect([...ran.logs, ...ran.errors]).toEqual([])
    }).pipe(Effect.provide(world()))
  )

  it.effect.each([
    { args: ["definitely-not"], code: "unknown-command", apiFamily: "cli" },
    { args: [], code: "missing-command", apiFamily: "cli" },
    {
      args: ["nyc-dot", "dataset", "query", "--name", "unknown", ...select, ...token],
      code: "invalid-option",
      apiFamily: "nyc-dot"
    }
  ])("$args fails with $code", ({ args, code, apiFamily }) =>
    Effect.gen(function* () {
      const ran = yield* ntk(["--json", ...args])
      expect(yield* envelope(ran)).toMatchObject({
        ok: false,
        error: { code },
        meta: { apiFamily }
      })
      expect(Exit.isFailure(ran.exit)).toBe(true)
    }).pipe(Effect.provide(world()))
  )

  it.effect("a query needs --select, since SODA3 would send every row of SELECT *", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["--json", "socrata", "query", ...speeds, ...token])
      expect(yield* envelope(ran)).toMatchObject({
        ok: false,
        error: { code: "missing-option", message: expect.stringContaining("--select") },
        meta: { apiFamily: "socrata" }
      })
      expect(yield* HttpTest.requests).toHaveLength(0)
    }).pipe(Effect.provide(world(HttpTest.soda3(() => Response.json(Samples.trafficSpeedRows)))))
  )

  it.effect("Socrata's refusal of a token carries Socrata's sentence", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["--json", "socrata", "query", ...speeds, ...select, ...token])
      expect(yield* envelope(ran)).toMatchObject({
        ok: false,
        error: { code: "socrata-error", message: "Invalid app_token specified" }
      })
    }).pipe(
      Effect.provide(
        world(HttpTest.soda3(() => Response.json(Samples.soda3InvalidAppToken, { status: 403 })))
      )
    )
  )

  it.effect("without --json a failure is one line on stderr", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["socrata", "query", ...speeds, ...select, ...token])
      expect(ran.errors).toEqual([
        `ntk: ${Samples.soda3AuthenticationRequired.message} (socrata-error)`
      ])
      expect(ran.logs).toEqual([])
      expect(ran.stdout).toBe("")
      expect(Exit.isFailure(ran.exit)).toBe(true)
    }).pipe(
      Effect.provide(
        world(
          HttpTest.layer(() => Response.json(Samples.soda3AuthenticationRequired, { status: 403 }))
        )
      )
    )
  )
})

describe("queries", () => {
  it.effect("rows come back in the envelope and --select becomes the query", () =>
    Effect.gen(function* () {
      const ran = yield* ntk([
        "--json",
        "nyc-dot",
        "dataset",
        "query",
        "--name",
        "traffic-speeds",
        "--select",
        "speed LIMIT 2",
        ...token
      ])
      expect(yield* envelope(ran)).toMatchObject({
        ok: true,
        data: { rows: Samples.trafficSpeedRows },
        meta: { apiFamily: "nyc-dot" }
      })
      const [request] = yield* HttpTest.requests
      expect(request?.url.href).toBe(
        "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9/query.json"
      )
      expect(request?.headers["x-app-token"]).toBe("test-token")
      // Socrata collects no traces, so none are propagated.
      expect(request?.headers.traceparent).toBeUndefined()
      expect(request?.body).toEqual({ query: "SELECT speed LIMIT 2" })
    }).pipe(Effect.provide(world(HttpTest.soda3(() => Response.json(Samples.trafficSpeedRows)))))
  )

  it.effect("the token can come from SOCRATA_APP_TOKEN", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["--json", "socrata", "query", ...speeds, ...select], {
        SOCRATA_APP_TOKEN: "env-token"
      })
      expect(yield* envelope(ran)).toMatchObject({ ok: true, data: { rows: [] } })
      const [request] = yield* HttpTest.requests
      expect(request?.headers["x-app-token"]).toBe("env-token")
    }).pipe(Effect.provide(world(HttpTest.soda3(() => Response.json([])))))
  )
})

describe("--dry-run", () => {
  it.effect("shows the request with the token redacted, and sends nothing", () =>
    Effect.gen(function* () {
      const ran = yield* ntk([
        "--json",
        "--dry-run",
        "socrata",
        "query",
        ...speeds,
        ...select,
        "--app-token",
        "secret-token"
      ])
      expect(yield* HttpTest.requests).toHaveLength(0)
      expect(ran.stdout).not.toContain("secret-token")
      expect(yield* envelope(ran)).toMatchObject({
        ok: true,
        data: {
          dryRun: true,
          requests: [
            {
              method: "POST",
              url: "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9/query.json",
              body: { query: "SELECT * LIMIT 2" }
            }
          ]
        }
      })
    }).pipe(Effect.provide(world()))
  )

  it.effect("touches no file, so even a missing directory shows the request", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const ran = yield* ntk([
        "--json",
        "--dry-run",
        "mta",
        "gtfs-static",
        "fetch",
        "--feed",
        "staten-island-bus",
        "--output",
        path.join(directory, "missing", "si.zip")
      ])
      expect(yield* envelope(ran)).toMatchObject({
        ok: true,
        data: {
          requests: [{ method: "GET", url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_si.zip" }]
        }
      })
      expect(yield* fs.readDirectory(directory)).toEqual([])
    }).pipe(Effect.provide(world()))
  )
})

describe("MTA realtime", () => {
  const feed = HttpTest.layer(() => new Response(Samples.statenIslandRailwayFeed))

  it.effect("probe counts what the feed holds; decode prints the feed itself", () =>
    Effect.gen(function* () {
      const probe = yield* envelope(yield* ntk(["--json", "mta", "gtfs-rt", "probe", ...sir]))
      expect(dataOf(probe)).toMatchObject({
        feed: "staten-island-railway",
        url: sirUrl,
        bytes: Samples.statenIslandRailwayFeed.byteLength,
        entities: 3,
        tripUpdates: 2,
        vehicles: 1,
        alerts: 0
      })
      const decode = yield* envelope(yield* ntk(["--json", "mta", "gtfs-rt", "decode", ...sir]))
      expect(dataOf(decode)).toMatchObject({ message: { header: { gtfsRealtimeVersion: "1.0" } } })
      expect(dataOf(decode)).not.toHaveProperty("entities")
    }).pipe(Effect.provide(world(feed)))
  )

  it.effect("--url fetches a mirror instead of the feed's own URL", () =>
    Effect.gen(function* () {
      yield* ntk([
        "--json",
        "mta",
        "gtfs-rt",
        "probe",
        ...sir,
        "--url",
        "https://mirror.example/si"
      ])
      const requests = yield* HttpTest.requests
      expect(requests.map((request) => request.url.href)).toEqual(["https://mirror.example/si"])
    }).pipe(Effect.provide(world(feed)))
  )

  it.effect("capture writes the bytes and a manifest, and nothing else", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const output = path.join(directory, "sir.pb")
      const manifestOutput = path.join(directory, "sir.json")
      const ran = yield* ntk([
        "--json",
        "mta",
        "gtfs-rt",
        "capture",
        ...sir,
        "--output",
        output,
        "--manifest-output",
        manifestOutput
      ])
      expect(yield* envelope(ran)).toMatchObject({ ok: true, data: { output, manifestOutput } })
      // Bun's FileSystem reads into a Buffer; compare the bytes alone.
      expect(new Uint8Array(yield* fs.readFile(output))).toEqual(Samples.statenIslandRailwayFeed)
      const manifest = yield* Schema.decodeUnknownEffect(
        Schema.fromJsonString(GtfsRealtime.CaptureManifest)
      )(yield* fs.readFileString(manifestOutput))
      expect(manifest.sha256).toBe(
        new Bun.CryptoHasher("sha256").update(Samples.statenIslandRailwayFeed).digest("hex")
      )
      expect((yield* fs.readDirectory(directory)).sort()).toEqual(["sir.json", "sir.pb"])
    }).pipe(Effect.provide(world(feed)))
  )

  it.effect("a download that breaks midway leaves no file behind", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped()
      const ran = yield* ntk([
        "--json",
        "mta",
        "gtfs-static",
        "fetch",
        "--feed",
        "staten-island-bus",
        "--output",
        path.join(directory, "si.zip")
      ])
      expect(yield* envelope(ran)).toMatchObject({ ok: false })
      expect(yield* fs.readDirectory(directory)).toEqual([])
    }).pipe(
      Effect.provide(
        world(
          HttpTest.layer(
            () =>
              new Response(
                new ReadableStream({
                  start(controller) {
                    controller.enqueue(Samples.gtfsStaticZipStart)
                    controller.error(new TypeError("connection reset"))
                  }
                })
              )
          )
        )
      )
    )
  )
})

describe("retries", () => {
  const flaky = (failure: () => Response) => {
    let calls = 0
    return HttpTest.layer(() =>
      ++calls === 1 ? failure() : new Response(Samples.statenIslandRailwayFeed)
    )
  }

  it.effect("a transient failure is retried after a backoff", () =>
    Effect.gen(function* () {
      const run = yield* Effect.forkChild(ntk(["--json", "mta", "gtfs-rt", "probe", ...sir]))
      yield* requestsReach(1)
      yield* TestClock.adjust("249 millis")
      expect(yield* HttpTest.requests).toHaveLength(1)
      yield* TestClock.adjust("1 millis")
      const ran = yield* Fiber.join(run)
      expect(yield* envelope(ran)).toMatchObject({ ok: true, data: { entities: 3 } })
      expect(yield* HttpTest.requests).toHaveLength(2)
    }).pipe(Effect.provide(world(flaky(() => new Response(null, { status: 503 })))))
  )

  it.effect("Retry-After holds the retry back for as long as it asks", () =>
    Effect.gen(function* () {
      const run = yield* Effect.forkChild(ntk(["--json", "mta", "gtfs-rt", "probe", ...sir]))
      yield* requestsReach(1)
      yield* TestClock.adjust("29 seconds")
      expect(yield* HttpTest.requests).toHaveLength(1)
      yield* TestClock.adjust("1 second")
      const ran = yield* Fiber.join(run)
      expect(yield* envelope(ran)).toMatchObject({ ok: true })
      expect(yield* HttpTest.requests).toHaveLength(2)
    }).pipe(
      Effect.provide(
        world(flaky(() => new Response(null, { status: 429, headers: { "retry-after": "30" } })))
      )
    )
  )

  it.effect("gives up after two retries with the last status", () =>
    Effect.gen(function* () {
      const run = yield* Effect.forkChild(ntk(["--json", "mta", "gtfs-rt", "probe", ...sir]))
      yield* requestsReach(1)
      yield* TestClock.adjust("250 millis")
      yield* requestsReach(2)
      yield* TestClock.adjust("500 millis")
      const ran = yield* Fiber.join(run)
      expect(yield* envelope(ran)).toMatchObject({ ok: false, error: { code: "http-status" } })
      expect(yield* HttpTest.requests).toHaveLength(3)
    }).pipe(Effect.provide(world(HttpTest.layer(() => new Response(null, { status: 503 })))))
  )

  it.effect("a missing feed is not retried", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["--json", "mta", "gtfs-rt", "probe", ...sir])
      expect(yield* envelope(ran)).toMatchObject({ ok: false, error: { code: "http-status" } })
      expect(yield* HttpTest.requests).toHaveLength(1)
    }).pipe(
      Effect.provide(
        world(HttpTest.layer(() => Response.json(Samples.mtaGatewayForbidden, { status: 403 })))
      )
    )
  )
})

describe("dataset commands", () => {
  it.effect("list needs no network", () =>
    Effect.gen(function* () {
      expect(yield* envelope(yield* ntk(["--json", "nyc-dot", "dataset", "list"]))).toMatchObject({
        ok: true,
        data: {
          datasets: [
            { name: "bus-lanes-local-streets", id: "ycrg-ses3" },
            { name: "traffic-speeds", id: "i4gi-tjb9", timestampColumn: "data_as_of" },
            { name: "traffic-volume-counts", id: "btm5-ppia", timestampColumn: "date" }
          ]
        }
      })
    }).pipe(Effect.provide(world()))
  )

  it.effect("info shows the columns Discovery lists", () =>
    Effect.gen(function* () {
      const ran = yield* ntk(["--json", "nyc-dot", "dataset", "info", "--name", "traffic-speeds"])
      expect(dataOf(yield* envelope(ran))).toMatchObject({
        id: "i4gi-tjb9",
        name: "DOT Traffic Speeds",
        columns: expect.arrayContaining([expect.objectContaining({ field: "data_as_of" })])
      })
    }).pipe(
      Effect.provide(world(HttpTest.layer(() => Response.json(Samples.catalogSearchResponse))))
    )
  )

  it.effect("NYC Open Data catalog search stays on its own domain", () =>
    Effect.gen(function* () {
      yield* ntk(["--json", "nyc-open-data", "catalog", "search", "--query", "speeds"])
      const [request] = yield* HttpTest.requests
      expect(request?.url.searchParams.get("domains")).toBe("data.cityofnewyork.us")
      expect(request?.url.searchParams.get("q")).toBe("speeds")
    }).pipe(
      Effect.provide(world(HttpTest.layer(() => Response.json(Samples.catalogSearchResponse))))
    )
  )
})
