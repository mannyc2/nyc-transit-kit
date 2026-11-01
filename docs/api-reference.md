# API Reference

Every public import path, what it exports, and the CLI. Each subpath is one
module, imported as a namespace:

```ts
import * as Soql from "@nyc-transit-kit/soda3/Soql"

export const queens = Soql.eq("borough", "Queens")
```

A package root re-exports its modules as namespaces
(`import { Soql } from "@nyc-transit-kit/soda3"`); import subpaths so bundlers
keep only what you use. For what is curated and why, see
[Provider coverage](provider-coverage.md).

Conventions that hold everywhere:

- An effect that calls a provider requires `HttpClient.HttpClient`. SODA3
  query and export also require `Soda3Client`.
- Nothing retries or times out on its own. Compose `HttpClient.retryTransient`,
  `Effect.retry` and `Effect.timeout` where you run it.
- Failures are typed: `HttpClientError` for transport and status failures,
  `SocrataError` with Socrata's own sentence, `DatasetNotFound`, `SoqlError`,
  `SchemaError` for a response that does not match its schema, and
  `GtfsRealtimeDecodeError`.
- Nothing reads the environment. Tokens and keys are `Redacted` values you
  pass in.

## @nyc-transit-kit/soda3

Socrata on any domain: SODA3 query and export, the Discovery API, and SoQL.

### `@nyc-transit-kit/soda3/Soda3Client`

| Export | What it does |
| --- | --- |
| `Soda3Client` | The service: `query(request)` returns rows, `export(request)` a byte stream. |
| `layer({ appToken })` | Builds the service on the `HttpClient` you provide. Sends `X-App-Token` on every request; SODA3 refuses query and export without one. |
| `streamRows(request, pageSize?)` | Every row of a query, one page per request, ending at the first short page. Default page size 1000. When the dataset changes while you page, order by a column that puts new rows last, or a page can repeat or skip rows. Takes no `orderingSpecifier`: SODA3 refuses paging with `discard`. |
| `countRows(ref, where?)` | `count(*)` as a number, optionally under a `Soql` fragment. |
| `viewUrl(ref, file)` | `https://{domain}/api/v3/views/{datasetId}/{file}`. |
| `QueryRequest`, `ExportRequest` | A `DatasetRef` plus the SODA3 body. `query` is SoQL text or a `Soql` fragment. `ExportRequest.range` asks for a byte range, which SODA3 ignored on 2026-11-01. |
| `QueryBody`, `ExportBody`, `QueryResponse`, `Row`, `Page`, `Parameters`, `ExportFormat`, `OrderingSpecifier`, `PositiveInt` | Schemas of the wire format. `ExportFormat` is `csv`, `json` or `geojson`; on 2026-11-01 SODA3 refused `json` and `geojson` with a 406. |
| `QueryError`, `ExportError` | What `query` and `export` fail with. |

Only the body fields SODA3 defines are sent, so a curated `Dataset` can be
spread into a request. SODA3 binds `parameters` only in parameterized views;
an ordinary query carries its values in the SoQL. SODA3 has no default limit:
a query without `LIMIT` or `page` returns every matching row. Each row ends
with the system columns `:id`, `:version`, `:created_at` and `:updated_at`
unless the request sets `includeSystem` or `includeSynthetic` to false.

```ts
import * as Socrata from "@nyc-transit-kit/soda3/Socrata"
import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as Soql from "@nyc-transit-kit/soda3/Soql"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

const speeds = {
  domain: Socrata.SocrataDomain.make("data.cityofnewyork.us"),
  datasetId: Socrata.SocrataDatasetId.make("i4gi-tjb9")
}

// A projection, so the rows come back untyped.
export const latestInManhattan = Effect.gen(function* () {
  const soda = yield* Soda3Client.Soda3Client
  return yield* soda.query({
    ...speeds,
    query: Soql.soql`SELECT link_name, speed, data_as_of WHERE ${Soql.eq("borough", "Manhattan")} ORDER BY data_as_of DESC LIMIT 10`
  })
})

export const queensReadings = Soda3Client.countRows(speeds, Soql.eq("borough", "Queens"))

export const firstKilobyte = Effect.gen(function* () {
  const soda = yield* Soda3Client.Soda3Client
  return yield* soda
    .export({ ...speeds, format: "csv", range: { start: 0, end: 1023 } })
    .pipe(Stream.decodeText(), Stream.mkString)
})
```

### `@nyc-transit-kit/soda3/Soql`

SoQL built as `effect/sql` Statement fragments. Text written in the `soql`
template is trusted SoQL; every interpolated value becomes a quoted literal
(`'Queens'`, with `'` doubled) and every `identifier` a backticked column, so
input never changes the shape of a query. SODA3 has no bind parameters outside
parameterized views (`:name` names a system column), so `compile` writes the
values into the text.

| Export | What it does |
| --- | --- |
| `` soql`...` `` | A fragment. Each interpolation is a value, an `identifier`, or another fragment spliced in place. |
| `identifier(name)` | A column or alias, written `` `name` `` so reserved words work. |
| `compile(fragment)` | The SoQL text, as `Effect<string, SoqlError>`. Fails on a column SoQL cannot name, a value it cannot write (such as `NaN`), and an empty `IN`. |
| `eq(column, value)`, `isIn(column, [value, ...values])`, `isNotNull(column)` | Filters. |
| `and([clause, ...clauses])`, `or([clause, ...clauses])` | Joins clauses, each in its own parentheses. |
| `selectAll({ where, orderBy, limit })` | `SELECT *` with the clauses that are given, in SoQL's order. |
| `timestamp(date)`, `monthWindow(month)`, `dateWindow(start, end)` | Floating-timestamp windows, half open. `dateWindow` fails with `SoqlError` on an empty window. |
| `timestampRange(column, window)`, `monthRange(column, month)` | A column inside a window. |
| `yearMonthRange(columns, start, end)` | Separate year and month columns inside a range, both end months included. Fails when the range starts after it ends. |
| `Fragment`, `Value`, `Clauses`, `OrderBy`, `SortDirection`, `TimestampWindow`, `YearMonth` | Types. |
| `SoqlError` | `message`. |

```ts
import * as Soql from "@nyc-transit-kit/soda3/Soql"

export const aceInFebruary = Soql.and([
  Soql.isIn("route_id", ["A", "C", "E"]),
  Soql.monthRange("service_date", { year: 2026, month: 2 })
])

// (`route_id` IN ('A','C','E')) AND (`service_date` >= '2026-02-01T00:00:00' AND `service_date` < '2026-03-01T00:00:00')
export const text = Soql.compile(aceInFebruary)
```

### `@nyc-transit-kit/soda3/Dataset`

| Export | What it does |
| --- | --- |
| `Dataset<Row>` | A curated dataset: a `DatasetRef` with `title`, `description`, `row` (the schema of one full row) and an optional `timestampColumn`. |
| `query(dataset, clauses?)` | `SELECT *` with `Soql.Clauses`; rows decoded with `dataset.row`. |
| `stream(dataset, clauses?, pageSize?)` | Every matching row, one page per request, decoded as it arrives. |
| `exportBytes(dataset, format, body?)` | The export as a byte stream. |

Typed queries always select whole rows, because the row schema describes whole
rows. Use `Soda3Client` for projections and aggregates.

### `@nyc-transit-kit/soda3/Discovery`

| Export | What it does |
| --- | --- |
| `search(search)` | Searches the public datasets of one domain. Needs no token. |
| `Search` | `domain`, and optionally `query`, `ids`, `categories`, `tags`, `order`, `limit` and `offset`. |
| `metadata(ref)` | One dataset's catalog entry. Fails with `DatasetNotFound` when the domain has no such public dataset. |
| `columns(result)` | The entry's columns as `{ field, name, datatype, description }`. |
| `url` | `https://api.us.socrata.com/api/catalog/v1`. |
| `SearchResponse`, `CatalogResult` | Schemas. |
| `DatasetNotFound` | `domain` and `datasetId`; the message reads "{domain} has no public dataset {datasetId}". |

### `@nyc-transit-kit/soda3/Socrata`

What every Socrata API shares.

| Export | What it does |
| --- | --- |
| `SocrataDomain`, `SocrataDatasetId`, `IsoDate` | Branded, checked strings. Use `.make` for literals and decode user input. |
| `DatasetRef` | `{ domain, datasetId }`. |
| `datasetUrl(ref)` | `https://{domain}/d/{datasetId}`, the dataset's page. |
| `SocrataError` | `status`, `code` when Socrata sent one, and `message`: Socrata's sentence, or "Socrata answered HTTP {status}". |
| `filterStatusOk(response)` | Passes 2xx responses and fails the rest with a `SocrataError` that keeps Socrata's sentence. |
| `FloatingTimestamp`, `MultiLineString`, `SocrataErrorBody` | Schemas. |

### `@nyc-transit-kit/soda3`

The root re-exports `Dataset`, `Discovery`, `Socrata`, `Soda3Client` and `Soql`
as namespaces.

## @nyc-transit-kit/mta

MTA feeds served by the MTA, and MTA datasets on NYS Open Data. Each feed table
is indexed by name, and each entry has a `title` and a `url`.

### `@nyc-transit-kit/mta/GtfsStatic`

| Export | What it does |
| --- | --- |
| `feeds` | `subway-regular`, `subway-supplemented`, `lirr`, `metro-north`, five borough bus feeds and `mta-bus-company`. Each has a `mode`. |
| `probe(url)` | `HEAD` a GTFS zip: `url`, `contentType`, `contentLength`, `lastModified` and `etag`, each `null` when absent. |
| `stream(url)` | The zip as a byte stream. |
| `Feed`, `FeedName` | Types. |

### `@nyc-transit-kit/mta/GtfsRealtime`

| Export | What it does |
| --- | --- |
| `feeds` | Subway line groups, `staten-island-railway`, `lirr`, `metro-north`, and five alert feeds. Each has a `kind`: `trip-updates` or `alerts`. |
| `fetchBytes(url)`, `fetchMessage(url)` | The feed's bytes, or the decoded `FeedMessage`. |
| `decode(bytes)` | Fails with `GtfsRealtimeDecodeError` unless the bytes are a FeedMessage. The MTA answers a wrong feed path with HTTP 200 and an XML error, so decoding is the check. |
| `summarize(message)` | Version, incrementality, header timestamp, and counts of entities, trip updates, vehicles and alerts. |
| `toJson(message)` | The message as plain JSON: 64-bit integers become numbers, enums become names. |
| `capture(feed, url)` | The raw bytes and a `CaptureManifest`: feed, URL, byte length, SHA-256 and capture time. Requires `Crypto`. Fails unless the bytes decode. |
| `CaptureManifest` | Schema of the manifest. |
| `GtfsRealtimeDecodeError`, `FeedMessage`, `Feed`, `FeedName` | The error, the message type from `gtfs-realtime-bindings`, and types. |

```ts
import * as GtfsRealtime from "@nyc-transit-kit/mta/GtfsRealtime"
import * as Effect from "effect/Effect"

export const alertCounts = Effect.forEach(
  ["alerts-subway", "alerts-bus"] as const,
  (name) =>
    Effect.map(GtfsRealtime.fetchMessage(GtfsRealtime.feeds[name].url), GtfsRealtime.summarize),
  { concurrency: 2 }
)
```

### `@nyc-transit-kit/mta/ElevatorEscalator`

| Export | What it does |
| --- | --- |
| `feeds` | `elevator-escalator-current` (upcoming outages included; `isupcomingoutage` tells them apart), `elevator-escalator-upcoming` and `elevator-escalator-equipment`. Each has a `row` schema. |
| `fetchRows(feed)` | The feed's rows, decoded with `feed.row`. The MTA serves them with the content type `${header.s3FileType}`; the body is JSON. |
| `Outage`, `Equipment` | Row schemas. |
| `Feed<Row>`, `FeedName` | Types. |

### `@nyc-transit-kit/mta/BusTime`

| Export | What it does |
| --- | --- |
| `feeds` | `vehicle-monitoring` and `stop-monitoring`. |
| `fetchJson(name, key, query?)` | Bus Time SIRI JSON, not modelled. `key` is `Redacted` and travels as a query parameter, as Bus Time requires; without one Bus Time answers 401. |
| `FeedName` | Type. |

### `@nyc-transit-kit/mta/MtaOpenData`

| Export | What it does |
| --- | --- |
| `domain` | `data.ny.gov`. |
| `datasets` | Curated `Dataset`s: `catalog`, the MTA Open Data Catalog (`f462-ka72`). |
| `CatalogRow`, `DatasetName` | The catalog's row schema, and a type. |

### `@nyc-transit-kit/mta`

The root re-exports `BusTime`, `ElevatorEscalator`, `GtfsRealtime`,
`GtfsStatic` and `MtaOpenData` as namespaces.

## @nyc-transit-kit/nyc-open-data

NYC Open Data, `data.cityofnewyork.us`, NYC DOT included.

### `@nyc-transit-kit/nyc-open-data/NycDot`

| Export | What it does |
| --- | --- |
| `datasets` | `bus-lanes-local-streets` (`ycrg-ses3`), `traffic-speeds` (`i4gi-tjb9`) and `traffic-volume-counts` (`btm5-ppia`). Each is a `Dataset` with its row schema. |
| `TrafficSpeedRow`, `BusLaneRow`, `TrafficVolumeRow` | Row schemas. |
| `DatasetName` | Type. |

Socrata sends numbers as text and leaves null cells out of a row. The row
schemas follow the columns as each portal declares them, and a column is
required only when every row of a 500-row sample had it. The system columns
SODA3 adds to each row are not part of the schemas, so decoding drops them.

```ts
import * as NycDot from "@nyc-transit-kit/nyc-open-data/NycDot"
import * as Dataset from "@nyc-transit-kit/soda3/Dataset"
import * as Soql from "@nyc-transit-kit/soda3/Soql"
import * as Stream from "effect/Stream"

// Staten Island speeds for October 2026, decoded page by page.
export const october = Dataset.stream(NycDot.datasets["traffic-speeds"], {
  where: Soql.and([
    Soql.eq("borough", "Staten Island"),
    Soql.monthRange("data_as_of", { year: 2026, month: 10 })
  ]),
  orderBy: { column: "data_as_of" }
}).pipe(Stream.runCollect)
```

### `@nyc-transit-kit/nyc-open-data/NycOpenData`

| Export | What it does |
| --- | --- |
| `domain` | `data.cityofnewyork.us`. |
| `datasets` | Curated datasets outside NYC DOT: none yet. Any dataset works by id through `@nyc-transit-kit/soda3`. |

### `@nyc-transit-kit/nyc-open-data`

The root re-exports `NycDot` and `NycOpenData` as namespaces.

## @nyc-transit-kit/fixtures

For your tests. See [Testing](testing.md) for how they fit together.

### `@nyc-transit-kit/fixtures/Samples`

Real responses, cut down to a few rows. Each export says when it was captured.

- Rows: `trafficSpeedRows`, `trafficVolumeRows`, `busLaneRows`,
  `mtaOpenDataCatalogRows` (SODA3 answers, system columns included),
  `elevatorOutageRows`, `elevatorEquipmentRows`.
- SODA3 beyond rows: `trafficSpeedQueensCount` and `trafficSpeedCount` (counts
  arrive as text) and `trafficSpeedCsv` (an `export.csv`).
- Socrata: `catalogSearchResponse`, `discoveryNoResults` (what Discovery sends
  for an unknown id), `discoveryDomainNotFound`, `soda3AuthenticationRequired`
  (the 403 SODA3 sends without a token), `soda3InvalidAppToken` (the 403 for
  a wrong one), `soda3NoSuchColumn` (a 400 query error),
  `soda3ExportTypeUnavailable` (the 406 for `json` and `geojson` exports) and
  `soda3DiscardWithPaging` (the 400 for paging without ordering).
- MTA: `statenIslandRailwayFeed` and `lirrAlertsFeed` (GTFS-realtime bytes),
  `mtaFeedNoSuchKey` (the HTTP 200 XML a wrong feed path gets),
  `mtaGatewayForbidden`, `gtfsStaticHeadHeaders`, `gtfsStaticZipStart`,
  `gtfsStaticAccessDenied` and `busTimeKeyRequired`.

### `@nyc-transit-kit/fixtures/HttpTest`

| Export | What it does |
| --- | --- |
| `layer(handler)` | An `HttpClient` that answers each request with `handler`, which returns a web `Response` or an Effect of one, plus the `Requests` it records. |
| `soda3(handler)` | `layer`, except that it refuses what SODA3 refuses, with SODA3's real answers: query and export without `X-App-Token` get the 403, `export.json` and `export.geojson` the 406, and paging with `orderingSpecifier: "discard"` the 400. |
| `requests` | Every request sent so far, oldest first. |
| `Requests`, `SentRequest`, `Handler` | The recording service and types. A `SentRequest` has `method`, `url` (a `URL`), `headers` and `body` (parsed JSON, text, or `undefined`). |

### `@nyc-transit-kit/fixtures`

The root re-exports `HttpTest` and `Samples` as namespaces.

## @nyc-transit-kit/cli

The app. Its modules let you drive the CLI from code and read what it prints.

### `@nyc-transit-kit/cli/Cli`

| Export | What it does |
| --- | --- |
| `run(args)` | One CLI run as an Effect. It needs an `HttpClient` and Bun's platform services; the binary provides `FetchHttpClient.layer` and `BunServices.layer`. |
| `command` | The `effect/cli` command tree. |

### `@nyc-transit-kit/cli/Envelope`

| Export | What it does |
| --- | --- |
| `Envelope` | Schema of what `ntk --json` prints: `{ ok: true, data, meta }` or `{ ok: false, error, meta }`. |
| `Meta`, `ErrorDetail`, `ApiFamily` | Its parts. |
| `schemaVersion` | `0.2.0`. It changes whenever the envelope or an error code changes. |

```ts
import * as Envelope from "@nyc-transit-kit/cli/Envelope"
import * as Schema from "effect/Schema"

// Read what `ntk --json` printed.
export const readEnvelope = Schema.decodeUnknownEffect(Schema.fromJsonString(Envelope.Envelope))
```

### `@nyc-transit-kit/cli/ReleaseManifest`

| Export | What it does |
| --- | --- |
| `ReleaseManifest`, `Artifact` | `ntk-release-manifest.json`, published beside the compiled binaries of a release. |
| `Platform`, `Architecture`, `Libc`, `ManifestVersion` | Its parts. |

### `@nyc-transit-kit/cli`

The root re-exports `Cli`, `Envelope` and `ReleaseManifest` as namespaces.

## CLI

```text
ntk socrata query --domain <domain> --dataset <id> --select <soql>
ntk socrata export --domain <domain> --dataset <id> --format csv|json|geojson --output <file>
ntk socrata range-probe --domain <domain> --dataset <id> --format <format> --range-end <n>
ntk catalog search --domain <domain> --query <text> [--limit <n>]

ntk nyc-open-data catalog search --query <text> [--limit <n>]
ntk nyc-open-data dataset list | info | query | export   --dataset <id>
ntk nyc-dot dataset list | info | query | export         --name <dataset>
ntk mta open-data dataset list | info | query | export   --dataset <id>

ntk mta gtfs-static list | probe | fetch       --feed <name> [--url <mirror>] [--output <file>]
ntk mta gtfs-rt list | probe | decode | capture --feed <name> [--url <mirror>] [--output <file> --manifest-output <file>]
ntk mta elevator-escalator --feed <name>
```

`query`, `export` and `range-probe` take `--app-token`, which defaults to
`SOCRATA_APP_TOKEN`. `--select` is required and takes a full SoQL query, or
just what follows `SELECT`, such as `"speed, link_id LIMIT 5"`. SODA3 has no
default limit, so a query without `LIMIT` returns every matching row. On
2026-11-01 SODA3 refused `json` and `geojson` exports, which fail with
`socrata-error`. `info` reads the catalog and needs no token. `gtfs-rt probe` counts what a feed holds; `decode` prints every
entity. `range-probe` asks for bytes `0..N` of an export: `receivedBytes` above
`requestedBytes` means the server ignored the range.

| Global flag | Effect |
| --- | --- |
| `--json` | Write exactly one envelope to stdout. |
| `--dry-run` | Print the requests the command would send, token redacted, and send none. Nothing is written. |
| `--help`, `-h` | Help. With `--json`, the help text arrives inside the envelope. |
| `--version`, `-v` | Version. With `--json`: version, schema version, commit and build target. |

An envelope is either `{ ok: true, data, meta }` or
`{ ok: false, error: { code, message }, meta }`, where `meta` holds `apiFamily`,
`generatedAt` and `schemaVersion`. The process exits 0 on success and 1 on
failure. Transient failures (network, 408, 429, 5xx) are retried twice with
exponential backoff from 250 ms, waiting at least as long as `Retry-After` asks.

| Error code | Cause |
| --- | --- |
| `socrata-error` | Socrata refused the request; the message is Socrata's. |
| `dataset-not-found` | The catalog has no such public dataset on that domain. |
| `http-status` | A non-Socrata provider answered with a non-2xx status. |
| `network-error` | The request did not complete. |
| `invalid-url`, `request-encode-error`, `response-decode-error`, `empty-response` | The other `HttpClientError` reasons. |
| `unexpected-response` | The response did not match its schema. |
| `not-gtfs-realtime` | The bytes are not a GTFS-realtime FeedMessage. |
| `file-error` | Reading or writing a file failed. |
| `missing-option`, `missing-argument`, `invalid-option`, `unknown-option`, `duplicate-option`, `unexpected-argument` | The arguments did not parse. |
| `unknown-command`, `missing-command` | No such command, or a command group without a subcommand. |
| `command-failed` | A command reported its own failure. |

| Environment variable | Read by |
| --- | --- |
| `SOCRATA_APP_TOKEN` | The CLI only, as the default for `--app-token`. |
