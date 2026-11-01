# Getting Started

`nyc-transit-kit` gives typed access to official NYC and MTA public data. The
libraries are Effect programs; the `ntk` CLI runs the same code from a shell.

## Install

The packages publish TypeScript source. Use Bun, or a toolchain that compiles
TypeScript in dependencies. `effect` is a peer dependency, so your app and the
kit share one copy:

```sh
bun add effect@^4.0.6 @nyc-transit-kit/soda3 @nyc-transit-kit/nyc-open-data @nyc-transit-kit/mta
```

Install only the provider packages you use. Each module is a namespace:
`import * as Dataset from "@nyc-transit-kit/soda3/Dataset"`.

## Compatibility

| nyc-transit-kit | effect | how the kit depends on it |
| --- | --- | --- |
| 0.1.0 / 0.1.1 | 4.0.0-beta.83 | exact dependency |
| 0.1.2 / 0.1.3 / 0.1.4 | 4.0.0-beta.92 | exact dependency |
| 0.2.0 | 4.0.0-beta.92 | exact dependency |
| 0.3.0 | ^4.0.6 | peer dependency; the CLI pins 4.0.6 |

Your compiler checks the kit's source with your settings, so the published
modules are type-checked under TypeScript 6 with `strict`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
`noPropertyAccessFromIndexSignature`, `isolatedModules`,
`verbatimModuleSyntax`, `module: Preserve` and `moduleResolution: Bundler`, and
without Bun or Node types; see
[`tsconfig.published.json`](../tsconfig.published.json).

## Query a curated dataset

A curated dataset carries the schema of its rows, so query results arrive
decoded. Filters are `Soql` fragments: columns are written as quoted
identifiers and values as SoQL literals, so input never changes the shape of
the query.

SODA3 refuses query and export without an app token. Create one in your Socrata
developer settings ([app tokens](https://dev.socrata.com/docs/app-tokens)). The
libraries never read the environment; your app reads the token and passes it in.

```ts
import * as NycDot from "@nyc-transit-kit/nyc-open-data/NycDot"
import * as Dataset from "@nyc-transit-kit/soda3/Dataset"
import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as Soql from "@nyc-transit-kit/soda3/Soql"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"

const latestStatenIslandSpeeds = Dataset.query(NycDot.datasets["traffic-speeds"], {
  where: Soql.eq("borough", "Staten Island"),
  orderBy: { column: "data_as_of", direction: "DESC" },
  limit: 10
})

const Soda3Live = Layer.unwrap(
  Effect.map(Config.Redacted("SOCRATA_APP_TOKEN"), (appToken) => Soda3Client.layer({ appToken }))
).pipe(Layer.provide(FetchHttpClient.layer))

const rows = await Effect.runPromise(latestStatenIslandSpeeds.pipe(Effect.provide(Soda3Live)))
for (const row of rows) {
  console.log(row.link_name, row.speed, row.data_as_of)
}
```

The query goes out as
``SELECT * WHERE `borough` = 'Staten Island' ORDER BY `data_as_of` DESC LIMIT 10``.
A row that does not match the schema fails the query with a `SchemaError`
instead of reaching your code half-formed.

## Query any dataset by id

The `Soda3Client` service takes any SoQL and returns plain rows. Use it for
projections, aggregates and datasets the kit does not curate. A query given as
a string is sent as written; build anything that holds input with `Soql`.

```ts
import * as Socrata from "@nyc-transit-kit/soda3/Socrata"
import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

const trafficSpeeds = {
  domain: Socrata.SocrataDomain.make("data.cityofnewyork.us"),
  datasetId: Socrata.SocrataDatasetId.make("i4gi-tjb9")
}

export const readingsPerBorough = Effect.gen(function* () {
  const soda = yield* Soda3Client.Soda3Client
  const byBorough = yield* soda.query({
    ...trafficSpeeds,
    query: "SELECT borough, count(*) AS readings GROUP BY borough ORDER BY borough"
  })
  const total = yield* Soda3Client.countRows(trafficSpeeds)
  return { byBorough, total }
})

// Every row, one page per request, ending at the first short page. Traffic
// Speeds grows while you page, so order it oldest first: new rows land last.
export const firstThousandLinks = Soda3Client.streamRows({
  ...trafficSpeeds,
  query: "SELECT link_id, link_name, data_as_of ORDER BY data_as_of"
}).pipe(Stream.take(1000), Stream.runCollect)
```

Both need a `Soda3Client` layer, as above.

## Search the catalog

The Discovery API needs no token.

```ts
import * as NycOpenData from "@nyc-transit-kit/nyc-open-data/NycOpenData"
import * as Discovery from "@nyc-transit-kit/soda3/Discovery"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"

const found = await Effect.runPromise(
  Discovery.search({ domain: NycOpenData.domain, query: "bus lanes", limit: 5 }).pipe(
    Effect.provide(FetchHttpClient.layer)
  )
)
for (const result of found.results) {
  console.log(result.resource.id, result.resource.name)
  console.log(Discovery.columns(result).map((column) => column.field))
}
```

## Read MTA feeds

GTFS-realtime feeds and the elevator and escalator feeds need no key.

```ts
import * as ElevatorEscalator from "@nyc-transit-kit/mta/ElevatorEscalator"
import * as GtfsRealtime from "@nyc-transit-kit/mta/GtfsRealtime"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"

const program = Effect.gen(function* () {
  const ace = yield* GtfsRealtime.fetchMessage(GtfsRealtime.feeds["subway-ace"].url)
  // The "current" feed lists upcoming outages too; isupcomingoutage tells them apart.
  const outages = yield* ElevatorEscalator.fetchRows(
    ElevatorEscalator.feeds["elevator-escalator-current"]
  )
  return {
    ace: GtfsRealtime.summarize(ace),
    elevatorsOutNow: outages.filter(
      (row) => row.equipmenttype === "EL" && row.isupcomingoutage === "N"
    ).length
  }
})

console.log(await Effect.runPromise(program.pipe(Effect.provide(FetchHttpClient.layer))))
```

## Retries and timeouts are yours

The libraries never retry and never time out on their own: how patient to be
with a provider is the caller's decision. Compose it on the `HttpClient` you
provide, or on the program:

```ts
import * as NycDot from "@nyc-transit-kit/nyc-open-data/NycDot"
import * as Dataset from "@nyc-transit-kit/soda3/Dataset"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"

// Retries network errors, 408, 429 and 5xx, waiting at least as long as Retry-After asks.
export const PatientHttp = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(
    HttpClient.HttpClient,
    HttpClient.retryTransient({ schedule: Schedule.exponential("250 millis"), times: 3 })
  )
).pipe(Layer.provide(FetchHttpClient.layer))

export const boundedQuery = Dataset.query(NycDot.datasets["traffic-speeds"], { limit: 100 }).pipe(
  Effect.timeout("10 seconds")
)
```

## Test your code without the network

`@nyc-transit-kit/fixtures` holds real responses, cut down, and `HttpTest`, an
`HttpClient` that answers from a handler and records every request. Your code
keeps its real client; only the transport is replaced. `HttpTest.soda3` refuses
what SODA3 refuses, such as a request without a token, with SODA3's real
answers. [Testing](testing.md) has more.

```ts
import { expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as NycDot from "@nyc-transit-kit/nyc-open-data/NycDot"
import * as Dataset from "@nyc-transit-kit/soda3/Dataset"
import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as Soql from "@nyc-transit-kit/soda3/Soql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"

const Soda3Test = Soda3Client.layer({ appToken: Redacted.make("test-token") }).pipe(
  Layer.provideMerge(HttpTest.soda3(() => Response.json(Samples.trafficSpeedRows)))
)

it.effect("asks SODA3 for Queens and decodes what it sends", () =>
  Effect.gen(function* () {
    const rows = yield* Dataset.query(NycDot.datasets["traffic-speeds"], {
      where: Soql.eq("borough", "Queens")
    })
    expect(rows).toHaveLength(Samples.trafficSpeedRows.length)
    const [request] = yield* HttpTest.requests
    expect(request?.url.pathname).toBe("/api/v3/views/i4gi-tjb9/query.json")
    expect(request?.body).toEqual({ query: "SELECT * WHERE `borough` = 'Queens'" })
  }).pipe(Effect.provide(Soda3Test))
)
```

## CLI

The CLI needs Bun at runtime.

```sh
bun add -d @nyc-transit-kit/cli
export SOCRATA_APP_TOKEN=...   # SODA3 query and export refuse requests without it

bunx ntk nyc-dot dataset query --name traffic-speeds --select "link_name, speed, data_as_of LIMIT 5"
bunx ntk catalog search --domain data.cityofnewyork.us --query "bus lanes" --limit 5
bunx ntk mta gtfs-rt probe --feed subway-ace
bunx ntk mta elevator-escalator --feed elevator-escalator-current --json
```

`--json` writes exactly one envelope to stdout. `--dry-run` prints the requests
a command would send, with the token redacted, and sends none of them. The
[API reference](api-reference.md#cli) lists every command and error code.

## Migrating 0.2.x To 0.3.0

0.3.0 moves to Effect 4.0.6 stable, gives each provider one package, and makes
every module a namespace. The CLI keeps its 0.2 commands and adds
`ntk mta elevator-escalator`; its JSON `schemaVersion` is now `0.2.0`.

Packages:

| 0.2.x | 0.3.0 |
| --- | --- |
| `effect` installed by the kit | add `effect@^4.0.6` to your app; the kit peers it |
| `@nyc-transit-kit/compat` | removed; run the Effect program with `Effect.runPromise` where your app starts |
| `querySoda3Rows`, `queryAllSoda3Rows`, `countSoda3Rows`, `exportSoda3Response` and the other `compat` functions | the same operation from the tables below, run with `Effect.runPromise(program.pipe(Effect.provide(layer)))` |
| `@nyc-transit-kit/contracts` | removed; each schema lives in the module of the provider that defines it (below) |
| `@nyc-transit-kit/nyc-dot` | `@nyc-transit-kit/nyc-open-data/NycDot` |
| `@nyc-transit-kit/soda3/endpoints`, `/transport`, `/client`, `/query`, `/export`, `/catalog`, `/metadata`, `/errors`, `/soql` | `/Soda3Client`, `/Dataset`, `/Discovery`, `/Socrata`, `/Soql` |
| `@nyc-transit-kit/mta/client`, `/errors`, `/feeds`, `/gtfs-static`, `/gtfs-realtime`, `/json-direct`, `/open-data` | `/GtfsStatic`, `/GtfsRealtime`, `/ElevatorEscalator`, `/BusTime`, `/MtaOpenData` |

Socrata:

| 0.2.x | 0.3.0 |
| --- | --- |
| `soda3Layer(options)`, `soda3ConfigLayer(options)`, `Soda3Live`, `Soda3ClientConfig` | `Soda3Client.layer({ appToken: Redacted.make(token) })` plus an `HttpClient` layer such as `FetchHttpClient.layer`; retry and timeout options as in the next row |
| `retryTimes`, timeout options, `withRequestPolicy` | `HttpClient.retryTransient`, `Effect.retry`, `Effect.timeout` on your side |
| `soda3FetchLayer(fetch)`, `FetchImplementation` | `FetchHttpClient.layer`, with your `fetch` provided under it as `Layer.succeed(FetchHttpClient.Fetch, fetch)` |
| `queryRows(input)` | the `Soda3Client` service's `query(request)`, or `Dataset.query(dataset, clauses)` for typed rows |
| `queryAllRows`, `countRows` | `Soda3Client.streamRows(request)` or `Dataset.stream(dataset)`, which pages oldest first by the dataset's `timestampColumn` unless given an `orderBy`; `Soda3Client.countRows(ref, where?)` |
| `exportResponse`, `Soda3ExportFormat` | the service's `export(request)` or `Dataset.exportBytes(dataset, body?)`, a CSV byte stream. There is no format to choose: on 2026-11-01 SODA3 refused `json` and `geojson` exports with a 406 |
| `catalogSearch`, `buildCatalogSearchUrl` | `Discovery.search(search)`, `Discovery.url` |
| `fetchDatasetMetadata` | `Discovery.metadata(ref)`; `Discovery.columns(result)` zips its columns |
| `buildQueryUrl`, `buildExportUrl` | `Soda3Client.viewUrl(ref, "query.json")`, `Soda3Client.viewUrl(ref, "export.csv")` |
| the `/transport` helpers: `fetchHttpClientLayer`, `isOkStatus`, `retryableStatus`, `httpFailureInfo` and the rest | Effect's `HttpClient`: `FetchHttpClient.layer`, `HttpClient.filterStatusOk`, `HttpClient.retryTransient` |
| `InvalidInputError`, `ProviderHttpError`, `ProviderContractError`, `TimeoutError`, `RetryExhaustedError` | `HttpClientError` from Effect, `Socrata.SocrataError` with Socrata's sentence, `SchemaError`, `Soql.SoqlError` |
| `Soda3ClientError` | `Soda3Client.QueryError`, or `Soda3Client.ExportError` for exports |
| `isSoda3ClientError(value)` | inside the program, `Effect.catchTag("SocrataError", …)` and the other tags; outside it, `Effect.runPromise` rejects with the error itself, so test `error instanceof Socrata.SocrataError` or `HttpClientError.isHttpClientError(error)` |
| `isRetryableProviderError` | `HttpClient.retryTransient`, which decides what is transient |
| `SocrataDomain`, `SocrataDatasetId`, `IsoDate` from `contracts/ids` | the same schemas in `@nyc-transit-kit/soda3/Socrata` |

SoQL. The 0.2 helpers sent values as `:name` placeholders, but SODA3 binds
`parameters` only in parameterized views and reads `:name` as a system column.
0.3.0 writes values as SoQL literals, so there are no parameter names, and the
filters are plain functions rather than effects:

| 0.2.x | 0.3.0 |
| --- | --- |
| `soqlEq(column, name, value)`, `soqlIn(column, name, values)` | `Soql.eq(column, value)`, `Soql.isIn(column, [value, ...values])` |
| `soqlIsNotNull`, `soqlAnd`, `soqlSelectAll` | `Soql.isNotNull`, `Soql.and` (and `Soql.or`), `Soql.selectAll(clauses)` |
| `soqlIdentifier`, `soqlParameterName`, `soqlParameter`, `SoqlParameters` | `Soql.identifier(name)` inside a `` Soql.soql`...` `` template; values need no names |
| `soqlOrderBy`, `soqlLimit` | the `orderBy` and `limit` clauses of `Soql.selectAll` and `Dataset.query` |
| `socrataTimestamp`, `socrataMonthWindow`, `socrataDateWindow` | `Soql.timestamp`, `Soql.monthWindow`, `Soql.dateWindow` |
| `soqlTimestampRange`, `soqlMonthWindow`, `soqlYearMonthRange` | `Soql.timestampRange(column, window)`, `Soql.monthRange(column, month)`, `Soql.yearMonthRange(columns, start, end)` |

MTA and NYC Open Data:

| 0.2.x | 0.3.0 |
| --- | --- |
| `mtaLayer`, `mtaConfigLayer`, `MtaClientConfig`, `MtaHttpLive`, `MtaLive`, `mtaFetchLayer` | any `HttpClient` layer; retries and timeouts as for Socrata |
| `MtaHttpError`, `MtaDecodeError` and the other MTA errors, `isMtaError` | `HttpClientError`, `SchemaError`, `GtfsRealtime.GtfsRealtimeDecodeError`, told apart as in the `isSoda3ClientError` row |
| `mtaGtfsStaticFeeds`, `mtaGtfsRealtimeFeeds`, `mtaJsonDirectFeeds`, `findMta*Feed` | `GtfsStatic.feeds`, `GtfsRealtime.feeds`, `ElevatorEscalator.feeds`, `BusTime.feeds`: index them by name |
| `probeGtfsStatic`, `fetchGtfsStatic`, `fetchGtfsStaticResponse` | `GtfsStatic.probe(url)`, `GtfsStatic.stream(url)` |
| `probeGtfsRealtime`, `decodeGtfsRealtimeBytes`, `GtfsRealtimeDecoder` | `GtfsRealtime.fetchMessage(url)`, `GtfsRealtime.decode(bytes)`, `GtfsRealtime.summarize(message)` |
| `decodeGtfsRealtimeBytesSync(bytes)` | `Effect.runSync(GtfsRealtime.decode(bytes))`: decoding needs no services, and a bad feed throws the `GtfsRealtimeDecodeError` |
| `captureGtfsRealtime` | `GtfsRealtime.capture(name, url)`; needs a `Crypto` layer such as `BunCrypto.layer` |
| `fetchMtaJsonDirect`, `decodeMtaElevatorEscalatorCurrent` | `ElevatorEscalator.fetchRows(ElevatorEscalator.feeds[name])`, decoded with the feed's row schema |
| `queryMtaOpenData`, `mtaOpenDataDatasets`, `mtaOpenDataDomain`, `mtaOpenDataCatalogDescriptor`, `findMtaOpenDataDataset` | `Dataset.query(MtaOpenData.datasets.catalog)`, `MtaOpenData.datasets`, `MtaOpenData.domain` |
| `nycDotDatasets`, `trafficSpeeds`, `busLanesLocalStreets`, `trafficVolumeCounts`, `findNycDotDataset`, `requireNycDotDataset`, `queryNycDotDataset`, `exportNycDotDataset` | `NycDot.datasets[name]` with `Dataset.query`, `Dataset.stream` and `Dataset.exportBytes` |
| `UnsupportedDatasetError`, `isUnsupportedDatasetError` | removed: `NycDot.datasets` is a typed record, so a name it lacks is a type error |
| `queryNycOpenDataDataset`, `exportNycOpenDataDataset`, `searchNycOpenDataCatalog` | the `Soda3Client` service, and `Discovery.search({ domain: NycOpenData.domain })` |
| `defaultDomain`, `knownNycOpenDataDatasets`, `findNycOpenDataDataset` | `NycOpenData.domain`, `NycOpenData.datasets` |
| `decodeTrafficSpeedRow` and the other row decoders | `Schema.decodeUnknownEffect(NycDot.TrafficSpeedRow)` and the other row schemas |
| `NycDotTrafficSpeedRow`, `NycDotBusLaneRow`, `NycDotTrafficVolumeRow`, `MtaOpenDataCatalogRow` | `NycDot.TrafficSpeedRow`, `NycDot.BusLaneRow`, `NycDot.TrafficVolumeRow`, `MtaOpenData.CatalogRow` |
| `MtaElevatorEscalatorCurrentRow` | `ElevatorEscalator.Outage`, `ElevatorEscalator.Equipment` |
| `MtaGtfsRealtimeCaptureManifest` | `GtfsRealtime.CaptureManifest` |
| descriptors, `makeDescriptorRegistry`, `lastVerified`, `tags`, `adapterStatus` | removed; a curated dataset is a plain `Dataset` record |

Fixtures and the CLI:

| 0.2.x | 0.3.0 |
| --- | --- |
| `sampleSoda3QueryResponse` and the other `sample*` fixtures | `Samples.*` from `@nyc-transit-kit/fixtures/Samples`: real responses, cut down |
| stubbing `fetch` in tests | `HttpTest.layer(handler)` or `HttpTest.soda3(handler)` |
| `CliEnvelope` and the rest of `contracts/cli` | `Envelope.Envelope`, `Envelope.Meta`, `Envelope.ErrorDetail`, `Envelope.ApiFamily` from `@nyc-transit-kit/cli/Envelope` |
| `CliReleaseManifest`, `CliReleaseArtifact` | `ReleaseManifest.ReleaseManifest`, `ReleaseManifest.Artifact` |
| `schemaVersion` `0.1.0`, `releaseVersion` | `Envelope.schemaVersion` is `0.2.0`; the release version is the package version |
| `packageName` exports | removed |
| CLI `SOCRATA_APP_TOKEN` optional | required for `socrata query`, `export`, `range-probe` and the `dataset query` and `export` commands |
| CLI `--format json`, `--format geojson` | refused as `invalid-option` before any request, since SODA3 answered both with a 406; `--format csv`, the default, still works |
| CLI `--json` help printed raw | `--json --help` answers with `{ ok: true, data: { help } }` |
| `ntk mta gtfs-rt decode` repeated `probe` | it prints every entity |

The row schemas changed with the data: `TrafficVolumeRow` uses Socrata's
`date` column (not `count_date`), and every curated row schema decodes real
rows captured on 2026-10-27.
