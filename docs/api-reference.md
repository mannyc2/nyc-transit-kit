# API Reference

This is the public API reference for the current v0 `nyc-transit-kit`
workspace. It covers the source-first package exports that exist in this
repository today.

For task-oriented adoption examples, start with
[Getting Started](getting-started.md).

Package-root imports are convenience paths for exploration. Prefer package
subpaths in application and package code so bundlers get the clearest
tree-shaking boundary.

## Import Rules

- Prefer subpaths such as `@nyc-transit-kit/soda3/client` and
  `@nyc-transit-kit/soda3/query`.
- Prefer deep Effect imports such as `effect/Effect` and `effect/Layer`.
- Core packages receive explicit config through arguments, services, and
  layers. They do not read `process.env`.
- Socrata-backed access is SODA3-only. Do not use legacy `/resource/` endpoint
  examples or helpers.
- `packages/cli` is the only package that may read CLI environment variables.

## `@nyc-transit-kit/contracts`

Contracts are `effect/Schema` schemas and their inferred TypeScript types. Use
them at boundaries where external payloads, CLI envelopes, release manifests,
and provider DTO fragments need validation.

| Import path | Purpose |
| --- | --- |
| `@nyc-transit-kit/contracts` | Convenience root with common schemas and inferred schema types. |
| `@nyc-transit-kit/contracts/metadata` | Package metadata, schema version, and API family. |
| `@nyc-transit-kit/contracts/ids` | Shared identifiers such as Socrata dataset IDs, domains, and ISO dates. |
| `@nyc-transit-kit/contracts/descriptors` | Generic descriptor registry helpers, NYC Open Data descriptors, and NYC DOT descriptor/row DTO contracts. |
| `@nyc-transit-kit/contracts/soda3` | SODA3 request, response, catalog, pagination, and export contracts. |
| `@nyc-transit-kit/contracts/mta` | MTA GTFS static, realtime, and Open Data descriptor contracts. |
| `@nyc-transit-kit/contracts/cli` | CLI success and error envelope schemas. |
| `@nyc-transit-kit/contracts/release` | CLI release manifest and artifact schemas. |

Important exports include `Soda3QueryRequest`, `Soda3QueryResponse`,
`Soda3ExportRequest`, `Soda3CatalogSearchResponse`, `MtaGtfsStaticFetchRequest`,
`MtaGtfsRealtimeProbeResult`, `MtaGtfsRealtimeDecodedSummary`,
`MtaGtfsRealtimeCaptureRequest`, `MtaGtfsRealtimeCaptureManifest`,
`MtaGtfsRealtimeCaptureResult`, `MtaJsonDirectSurface`,
`MtaJsonDirectFetchRequest`, `MtaJsonDirectFetchResult`,
`MtaOpenDataCatalogRow`, `MtaElevatorEscalatorCurrentRow`,
`MtaElevatorEscalatorCurrent`,
`NycOpenDataDatasetDescriptor`, `NycDotDatasetDescriptor`,
`DatasetDescriptorAdapterStatus`, `DatasetDescriptorMetadataFields`,
`makeDescriptorRegistry`, `CliEnvelope`, and `CliReleaseManifest`.

```ts
import { Soda3QueryRequest } from "@nyc-transit-kit/contracts/soda3"
import * as Schema from "effect/Schema"

const decodeQuery = Schema.decodeUnknownEffect(Soda3QueryRequest)
```

## `@nyc-transit-kit/soda3`

`@nyc-transit-kit/soda3` is the generic Socrata SODA3 client package. It owns
endpoint construction, query/export/catalog operations, provider errors, retry
classification, and the HTTP/config layers used by Socrata-backed provider
families.

| Import path | Purpose |
| --- | --- |
| `@nyc-transit-kit/soda3` | Convenience root for the main SODA3 surface. |
| `@nyc-transit-kit/soda3/client` | Service and high-level operation re-exports. |
| `@nyc-transit-kit/soda3/query` | `queryRows`, `queryAllRows`, and `countRows` operations. |
| `@nyc-transit-kit/soda3/export` | `exportResponse` operation. |
| `@nyc-transit-kit/soda3/catalog` | `catalogSearch` and `buildCatalogSearchUrl`. |
| `@nyc-transit-kit/soda3/metadata` | Discovery-backed exact dataset metadata lookup. |
| `@nyc-transit-kit/soda3/endpoints` | SODA3 URL builders and request decoders. |
| `@nyc-transit-kit/soda3/errors` | SODA3 typed errors, `isSoda3ClientError`, and retry helpers. |
| `@nyc-transit-kit/soda3/soql` | SoQL constants, validated identifiers, parameter fragments, ordering, and Socrata date-window helpers. |
| `@nyc-transit-kit/soda3/transport` | Low-level shared HTTP transport policy helpers used by provider packages. |

Important exports:

| Export | Import path | Notes |
| --- | --- | --- |
| `queryRows` | `@nyc-transit-kit/soda3/query` or `@nyc-transit-kit/soda3/client` | Runs a SODA3 query and returns decoded rows. |
| `queryAllRows` | `@nyc-transit-kit/soda3/query` or `@nyc-transit-kit/soda3/client` | Runs a SODA3 query page-by-page until a short page is returned. |
| `countRows` | `@nyc-transit-kit/soda3/query` or `@nyc-transit-kit/soda3/client` | Runs `SELECT count(*)` with an optional `WHERE` clause and returns a numeric count. |
| `exportResponse` | `@nyc-transit-kit/soda3/export` or `@nyc-transit-kit/soda3/client` | Returns the raw export `Response`. |
| `catalogSearch` | `@nyc-transit-kit/soda3/catalog` or `@nyc-transit-kit/soda3/client` | Searches Socrata discovery catalog. |
| `fetchDatasetMetadata` | `@nyc-transit-kit/soda3/metadata` or `@nyc-transit-kit/soda3/client` | Fetches one exact Discovery catalog result by domain and dataset id. |
| `Soda3ClientConfig` | `@nyc-transit-kit/soda3/client` | Effect service for app token, retry count, retry delay, and timeout config. |
| `soda3Layer` | `@nyc-transit-kit/soda3/client` | Explicit config and fetch layer for SODA3 programs. |
| `soda3ConfigLayer` | `@nyc-transit-kit/soda3/client` | Builds only the SODA3 config service layer. |
| `soda3FetchLayer` | `@nyc-transit-kit/soda3/client` | Builds the live or custom-fetch HTTP layer. |
| `Soda3HttpLive` | `@nyc-transit-kit/soda3/client` | Live Effect HTTP layer backed by `globalThis.fetch`. |
| `Soda3Live` | `@nyc-transit-kit/soda3/client` | Default config plus live Effect HTTP layer. |
| `Soda3ClientConfigShape` | `@nyc-transit-kit/soda3/client` | Type for config service values. |
| `Soda3LayerOptions` | `@nyc-transit-kit/soda3/client` | Type for `soda3Layer` options, including custom fetch. |
| `FetchImplementation` | `@nyc-transit-kit/soda3/client` | Minimal structural fetch type accepted by SODA3 and MTA fetch layers. |
| `buildQueryUrl` | `@nyc-transit-kit/soda3/endpoints` | Builds `/api/v3/views/<dataset>/query.json`. |
| `buildExportUrl` | `@nyc-transit-kit/soda3/endpoints` | Builds SODA3 export URLs. |
| `buildCatalogSearchUrl` | `@nyc-transit-kit/soda3/endpoints` | Builds Socrata discovery search URLs. |
| `decodeSoda3QueryRequest` | `@nyc-transit-kit/soda3/endpoints` | Validates query inputs. |
| `decodeSoda3ExportRequest` | `@nyc-transit-kit/soda3/endpoints` | Validates export inputs. |
| `decodeSoda3CatalogSearchRequest` | `@nyc-transit-kit/soda3/endpoints` | Validates catalog inputs. |
| `defaultSocrataProtocol` | `@nyc-transit-kit/soda3/endpoints` | Current SODA3 protocol constant. |
| `discoveryApiHost` | `@nyc-transit-kit/soda3/endpoints` | Socrata discovery host. |
| `socrataApiVersion` | `@nyc-transit-kit/soda3/endpoints` | Current Socrata API version. |
| `InvalidInputError` | `@nyc-transit-kit/soda3/errors` | Input failed contract validation. |
| `ProviderHttpError` | `@nyc-transit-kit/soda3/errors` | HTTP/provider failure. |
| `ProviderContractError` | `@nyc-transit-kit/soda3/errors` | Provider payload failed expected contract. |
| `TimeoutError` | `@nyc-transit-kit/soda3/errors` | Timeout failure. |
| `RetryExhaustedError` | `@nyc-transit-kit/soda3/errors` | Retry budget exhausted. |
| `isSoda3ClientError` | `@nyc-transit-kit/soda3/errors` | Narrows native SODA3 client failures. |
| `isRetryableProviderError` | `@nyc-transit-kit/soda3/errors` | Narrows retryable provider failures. |
| `withRequestPolicy` | `@nyc-transit-kit/soda3/transport` | Applies shared retry, exhaustion, and timeout behavior with provider-specific error adapters. |
| `toWebResponse` | `@nyc-transit-kit/soda3/transport` | Converts an Effect HTTP response into a Web `Response` without buffering the body. |
| `contentLengthOf` | `@nyc-transit-kit/soda3/transport` | Reads a non-negative integer `content-length` header when one is present. |
| `redactedUrl` | `@nyc-transit-kit/soda3/transport` | Redacts key, token, and secret query parameters for safe output. |
| `fetchHttpClientLayer` | `@nyc-transit-kit/soda3/transport` | Builds an Effect HTTP client layer from `globalThis.fetch` or a custom fetch implementation. |
| `soqlSelectAll` | `@nyc-transit-kit/soda3/soql` | `"SELECT *"`. |
| `soqlLimit` | `@nyc-transit-kit/soda3/soql` | Adds a validated `LIMIT`. |
| `soqlIdentifier` | `@nyc-transit-kit/soda3/soql` | Validates a column/expression identifier before interpolating it into query text. |
| `soqlParameterName` | `@nyc-transit-kit/soda3/soql` | Validates a bind parameter name. |
| `soqlParameter` | `@nyc-transit-kit/soda3/soql` | Builds a single placeholder fragment and parameter bag. |
| `soqlEq` | `@nyc-transit-kit/soda3/soql` | Builds a parameterized equality predicate. |
| `soqlIn` | `@nyc-transit-kit/soda3/soql` | Builds a parameterized `IN` predicate with generated names. |
| `soqlIsNotNull` | `@nyc-transit-kit/soda3/soql` | Builds an `IS NOT NULL` predicate. |
| `soqlAnd` | `@nyc-transit-kit/soda3/soql` | Parenthesizes fragments and merges parameter bags. |
| `soqlOrderBy` | `@nyc-transit-kit/soda3/soql` | Builds a validated `ORDER BY <column> ASC/DESC` clause. |
| `socrataTimestamp` | `@nyc-transit-kit/soda3/soql` | Converts an ISO date or UTC `Date` into Socrata midnight timestamp text. |
| `socrataDateWindow` | `@nyc-transit-kit/soda3/soql` | Builds an exclusive Socrata timestamp window from two ISO dates. |
| `socrataMonthWindow` | `@nyc-transit-kit/soda3/soql` | Builds a calendar-month Socrata timestamp window. |
| `soqlTimestampRange` | `@nyc-transit-kit/soda3/soql` | Builds a half-open timestamp range predicate and parameters. |
| `soqlMonthWindow` | `@nyc-transit-kit/soda3/soql` | Combines `socrataMonthWindow` and `soqlTimestampRange`. |
| `soqlYearMonthRange` | `@nyc-transit-kit/soda3/soql` | Builds an inclusive range for datasets that store year/month columns separately. |

Catalog search uses Socrata's Discovery API. `Soda3CatalogSearchRequest`
supports `query`, `ids`, `categories`, `tags`, `order`, `limit`, and `offset`
in addition to the required `domain`. `Soda3CatalogSearchResponse` mirrors the
Discovery wire shape: the result count is `resultSetSize`, dataset domain is
available on each result's `metadata.domain`, and generic discovery fields such
as `classification.domain_metadata`, `resource.columns_name`,
`resource.columns_field_name`, `resource.columns_datatype`, `permalink`, and
`warnings` decode when present.

`fetchDatasetMetadata` is a thin exact-id Discovery lookup over the same catalog
result contract. It calls `/api/catalog/v1` with `domains`, `search_context`,
`only=dataset`, `ids`, and `limit=1`; it does not call legacy `/api/views/...`,
`/resource/...`, or a guessed SODA3 view metadata URL.

`queryAllRows` makes independent page requests with the same SoQL query. Include
an explicit `ORDER BY` in the query, or choose an appropriate SODA3
`orderingSpecifier`, whenever stable pagination matters.

SODA3 retry config uses `retryTimes` plus optional `retryDelayMs`. A missing or
zero `retryDelayMs` preserves immediate retries; a positive value uses
exponential backoff. `timeoutMs` is a total budget covering all retry attempts.

Effect-native SODA3 query:

```ts
import { soda3Layer } from "@nyc-transit-kit/soda3/client"
import { queryRows } from "@nyc-transit-kit/soda3/query"
import * as Effect from "effect/Effect"

const program = queryRows({
  domain: "data.cityofnewyork.us",
  datasetId: "ycrg-ses3",
  query: "SELECT *"
}).pipe(Effect.provide(soda3Layer({ appToken: "example-token", retryTimes: 2 })))
```

Parameterized SoQL fragments:

```ts
import { queryRows } from "@nyc-transit-kit/soda3/query"
import { soqlAnd, soqlEq, soqlIsNotNull, soqlMonthWindow } from "@nyc-transit-kit/soda3/soql"
import * as Effect from "effect/Effect"

const program = Effect.gen(function* () {
  const routePredicate = yield* soqlEq("route_id", "route", "M15")
  const tripPredicate = yield* soqlIsNotNull("trip_id")
  const monthPredicate = yield* soqlMonthWindow("captured_at", 2026, 6, "window")
  const where = yield* soqlAnd([routePredicate, tripPredicate, monthPredicate])

  return yield* queryRows({
    domain: "data.cityofnewyork.us",
    datasetId: "ycrg-ses3",
    query: `SELECT * WHERE ${where.text}`,
    parameters: where.parameters
  })
})
```

SODA3 endpoint builder:

```ts
import { buildQueryUrl } from "@nyc-transit-kit/soda3/endpoints"
import * as Effect from "effect/Effect"

const url = await Effect.runPromise(
  buildQueryUrl({
    domain: "data.cityofnewyork.us",
    datasetId: "ycrg-ses3",
    query: "SELECT *"
  })
)

url.pathname
// "/api/v3/views/ycrg-ses3/query.json"
```

## `@nyc-transit-kit/mta`

`@nyc-transit-kit/mta` owns MTA GTFS static, GTFS realtime, and MTA Open Data
helpers. MTA Open Data access delegates through SODA3.

| Import path | Purpose |
| --- | --- |
| `@nyc-transit-kit/mta` | Convenience root for the main MTA surface. |
| `@nyc-transit-kit/mta/client` | MTA HTTP/config layers: `MtaClientConfig`, `mtaConfigLayer`, `mtaFetchLayer`, `mtaLayer`, and `MtaHttpLive`. |
| `@nyc-transit-kit/mta/gtfs-static` | GTFS static fetch/probe operations and `MtaHttpLive`. |
| `@nyc-transit-kit/mta/gtfs-realtime` | GTFS realtime probe operation and decoder service. |
| `@nyc-transit-kit/mta/feeds` | MTA direct feed descriptors and lookup helpers. |
| `@nyc-transit-kit/mta/json-direct` | Raw JSON direct-feed fetch helper plus elevator/escalator current row decoder. |
| `@nyc-transit-kit/mta/open-data` | MTA Open Data descriptors, lookup helpers, SODA3 query helper, and catalog row decoder. |
| `@nyc-transit-kit/mta/errors` | MTA typed errors and `isMtaError`. |

Important exports include `MtaClientConfig`, `mtaConfigLayer`, `mtaFetchLayer`,
`mtaLayer`, `MtaHttpLive`, `probeGtfsStatic`, `fetchGtfsStatic`,
`fetchGtfsStaticResponse`,
`GtfsRealtimeDecoder`, `GtfsRealtimeDecoderImplementation`,
`decodeGtfsRealtimeBytes`, `decodeGtfsRealtimeBytesSync`,
`probeGtfsRealtime`, `captureGtfsRealtime`,
`fetchMtaJsonDirect`, `redactMtaJsonDirectUrl`, `queryMtaOpenData`,
`decodeMtaOpenDataCatalogRow`, `decodeMtaOpenDataCatalogRows`,
`decodeMtaElevatorEscalatorCurrent`,
`mtaOpenDataDomain`, `mtaOpenDataCatalogDescriptor`, `mtaOpenDataDatasets`,
`findMtaOpenDataDataset`, `mtaGtfsStaticFeeds`, `mtaGtfsRealtimeFeeds`,
`mtaJsonDirectFeeds`, `mtaDirectFeeds`, `findMtaGtfsStaticFeed`,
`findMtaGtfsRealtimeFeed`, `findMtaJsonDirectFeed`, `MtaInvalidInputError`,
`MtaHttpError`, `MtaDecodeError`, `MtaTimeoutError`,
`MtaRetryExhaustedError`, and `MtaError`.

MTA direct-feed config uses `retryTimes`, optional `retryDelayMs`, and optional
`timeoutMs`, with the same semantics as SODA3. Existing callers can still
provide only an HTTP layer; the MTA config service defaults to no retries when
absent.

Use `mtaOpenDataDatasets` and `findMtaOpenDataDataset` as the scalable
descriptor discovery surface. Existing named descriptor constants remain
available for compatibility, but future catalog additions should not require a
new public constant unless they also get a curated adapter.

Use `mtaGtfsStaticFeeds`, `mtaGtfsRealtimeFeeds`, and `mtaDirectFeeds` for
official direct feed discovery. CLI direct feed commands resolve `--feed` by
descriptor id or name, while `--url` remains available as an advanced override.

GTFS static probe with injected fetch:

```ts
import { mtaFetchLayer, probeGtfsStatic } from "@nyc-transit-kit/mta/gtfs-static"
import type { FetchImplementation } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"

const customFetch: FetchImplementation = async () =>
  new Response(null, {
    status: 200,
    headers: { "content-type": "application/zip" }
  })

const program = probeGtfsStatic({
  url: "https://new.mta.info/feed.zip"
}).pipe(Effect.provide(mtaFetchLayer(customFetch)))
```

GTFS realtime uses `GtfsRealtimeDecoder.Live` by default at the CLI and Promise
compat edges. The live decoder parses standard GTFS-RT `FeedMessage` bytes and
returns a stable decoded summary with optional `feed`, `entityCount`,
`tripUpdateCount`, `vehiclePositionCount`, `alertCount`, optional `header`, and
`raw` decoded data. `feed` is a caller-supplied label; decode-only callers can
call `decodeGtfsRealtimeBytes(bytes)` or `decodeGtfsRealtimeBytesSync(bytes)`
without it, and the summary will omit `feed`. MTA custom extension fields can
remain available inside `raw`, but v0 does not yet normalize every MTA extension
into first-class schemas.

Use `GtfsRealtimeDecoder.Passthrough` only for tests or caller-provided fallback
behavior when you intentionally do not want protobuf decoding.

```ts
import { GtfsRealtimeDecoder, probeGtfsRealtime } from "@nyc-transit-kit/mta/gtfs-realtime"
import { MtaHttpLive } from "@nyc-transit-kit/mta/client"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const program = probeGtfsRealtime({
  feed: "vehicle-positions",
  url: "https://api-endpoint.mta.info/realtime.pb"
}).pipe(Effect.provide(Layer.mergeAll(MtaHttpLive, GtfsRealtimeDecoder.Live)))
```

GTFS realtime raw capture fetches the exact protobuf bytes and returns a
metadata manifest with a SHA-256 digest and redacted URL. The result includes
`bytes`; the manifest shape intentionally does not.

```ts
import { captureGtfsRealtime } from "@nyc-transit-kit/mta/gtfs-realtime"
import { MtaHttpLive } from "@nyc-transit-kit/mta/client"
import * as Effect from "effect/Effect"

const program = captureGtfsRealtime({
  feed: "trip-updates",
  url: "https://api-endpoint.mta.info/realtime.pb?key=secret"
}).pipe(Effect.provide(MtaHttpLive))
```

Raw MTA JSON direct feeds fetch provider JSON without normalizing the payload.
API keys are supplied explicitly and redacted from returned metadata.

```ts
import { findMtaJsonDirectFeed } from "@nyc-transit-kit/mta/feeds"
import { fetchMtaJsonDirect } from "@nyc-transit-kit/mta/json-direct"
import { MtaHttpLive } from "@nyc-transit-kit/mta/client"
import * as Effect from "effect/Effect"

const feed = findMtaJsonDirectFeed("bus-time-vehicle-monitoring")

const program =
  feed === undefined
    ? Effect.void
    : fetchMtaJsonDirect({
        surface: feed.surface,
        url: feed.url,
        apiKey: "example-token",
        query: {
          LineRef: "MTA NYCT_M15"
        }
      }).pipe(Effect.provide(MtaHttpLive))
```

Selected MTA adapters decode provider DTO fragments without adding downstream
analytics or normalized business meaning.

```ts
import { decodeMtaOpenDataCatalogRow } from "@nyc-transit-kit/mta/open-data"
import { decodeMtaElevatorEscalatorCurrent } from "@nyc-transit-kit/mta/json-direct"
import * as Effect from "effect/Effect"

const program = Effect.gen(function* () {
  const catalogRow = yield* decodeMtaOpenDataCatalogRow({
    "Open Dataset ID": "f462-ka72",
    Name: "MTA Open Data Catalog"
  })
  const elevatorRows = yield* decodeMtaElevatorEscalatorCurrent([
    {
      station: "Example Station",
      equipment: "EL001",
      equipmenttype: "EL"
    }
  ])

  return {
    catalogRow,
    elevatorRows
  }
})
```

## `@nyc-transit-kit/nyc-open-data`

`@nyc-transit-kit/nyc-open-data` owns NYC Open Data domain defaults, descriptors,
catalog helpers, and SODA3-backed dataset query/export helpers.

| Import path | Purpose |
| --- | --- |
| `@nyc-transit-kit/nyc-open-data` | Convenience root for the main NYC Open Data surface. |
| `@nyc-transit-kit/nyc-open-data/client` | Query, export, and catalog helpers. |
| `@nyc-transit-kit/nyc-open-data/descriptors` | Domain/default descriptor constants and lookup helpers. |

Important exports include `queryNycOpenDataDataset`,
`exportNycOpenDataDataset`, `searchNycOpenDataCatalog`, `defaultDomain`,
`knownNycOpenDataDatasets`, and `findNycOpenDataDataset`.

`knownNycOpenDataDatasets` and `findNycOpenDataDataset` are reserved for curated
NYC Open Data descriptors not already owned by a narrower provider package.
DOT datasets hosted on NYC Open Data live under `@nyc-transit-kit/nyc-dot`.
Generic NYC Open Data query and export helpers still accept any Socrata dataset
id on `data.cityofnewyork.us`.

NYC Open Data query with injected SODA3 fetch:

```ts
import { queryNycOpenDataDataset } from "@nyc-transit-kit/nyc-open-data/client"
import { soda3Layer, type FetchImplementation } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"

const customFetch: FetchImplementation = async () => Response.json({ rows: [] })

const program = queryNycOpenDataDataset({
  datasetId: "ycrg-ses3",
  query: "SELECT *"
}).pipe(Effect.provide(soda3Layer({ fetch: customFetch })))
```

## `@nyc-transit-kit/nyc-dot`

`@nyc-transit-kit/nyc-dot` owns NYC DOT dataset descriptors, DTO decoders, and
thin SODA3-backed query/export adapters.

| Import path | Purpose |
| --- | --- |
| `@nyc-transit-kit/nyc-dot` | Convenience root for the main NYC DOT surface. |
| `@nyc-transit-kit/nyc-dot/datasets` | Dataset descriptors, lookup helpers, query/export helpers, and typed unsupported-dataset errors. |
| `@nyc-transit-kit/nyc-dot/rows` | Selected NYC DOT row DTO decoders. |

Important exports include `queryNycDotDataset`, `exportNycDotDataset`,
`nycDotDatasets`, `initialDatasetIds`, `nycDotOpenDataDomain`,
`findNycDotDataset`, `requireNycDotDataset`, `busLanesLocalStreets`,
`trafficSpeeds`, `trafficVolumeCounts`, `decodeBusLaneRow`,
`decodeTrafficSpeedRow`, `decodeTrafficVolumeRow`, and
`UnsupportedDatasetError`.

Use `nycDotDatasets`, `initialDatasetIds`, and `findNycDotDataset` as the
scalable descriptor discovery surface. Existing named descriptor constants remain
available for compatibility; future descriptors do not need one-off named
exports unless they get curated row DTO adapters.

NYC DOT query by dataset name:

```ts
import { queryNycDotDataset } from "@nyc-transit-kit/nyc-dot/datasets"
import { Soda3ClientConfig, Soda3HttpLive } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const program = queryNycDotDataset({
  name: "traffic-speeds",
  query: "SELECT *"
}).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, Soda3HttpLive)))
```

## Descriptor Batch Updates

Provider descriptor manifests are checked TypeScript records under private
provider `src/internal/` modules. Add curated local JSON batches with the root
helper script; dry-run first, then pass `--write` to update the manifest.

```sh
bun run scripts/update-descriptor-records.ts --provider nyc-dot --input ./tmp/dot-descriptors.json
bun run scripts/update-descriptor-records.ts --provider nyc-dot --input ./tmp/dot-descriptors.json --write
```

Supported providers are `nyc-open-data`, `nyc-dot`, and `mta-open-data`. The
input may be normalized descriptor records or Socrata catalog-like fragments
with `resource.id`, `resource.name`, optional `resource.description`, and
`metadata.domain`. Normalized records may also include `sourceUrl`,
`tags`, `temporalFields`, `adapterStatus`, and `lastVerified`; the update script
preserves those fields and validates them through the provider descriptor
schemas. The script validates records locally; default tests do not contact live
providers.

Coverage policy is documented in [Provider Coverage](provider-coverage.md).
Use the offline coverage checker with local official-source snapshots before
calling a curated descriptor scope complete:

```sh
bun run scripts/check-provider-coverage.ts --provider nyc-dot --input ./tmp/dot-source.json
```

For release evidence, collect local snapshots into a manifest and run the
set-level checker:

```sh
bun run scripts/check-provider-coverage-set.ts --manifest ./tmp/provider-snapshots/manifest.json --out .release/evidence/provider-coverage.json
```

## `@nyc-transit-kit/compat`

`@nyc-transit-kit/compat` is a Promise facade over Effect programs. It should be
used by consumers who do not want to own an Effect runtime directly. It does not
duplicate endpoint construction, retries, schemas, or provider logic.

| Import path | Purpose |
| --- | --- |
| `@nyc-transit-kit/compat` | Convenience root for Promise wrappers and shared error exports. |
| `@nyc-transit-kit/compat/soda3` | `querySoda3Rows`, `queryAllSoda3Rows`, `countSoda3Rows`, `fetchSoda3DatasetMetadata`, `exportSoda3Response`, `searchSoda3Catalog`, and `Soda3CompatOptions`. |
| `@nyc-transit-kit/compat/mta` | MTA GTFS static, GTFS realtime, JSON direct, and Open Data Promise wrappers. |
| `@nyc-transit-kit/compat/nyc-open-data` | `queryNycOpenDataRows`, `exportNycOpenDataResponse`, `searchNycOpenData`. |
| `@nyc-transit-kit/compat/nyc-dot` | `queryNycDotRows` and `exportNycDotResponse`. |
| `@nyc-transit-kit/compat/errors` | Shared native error exports, provider-family guards, and `isTransitKitCompatError`. |

Compat means Promise facade over Effect programs. It does not mean SODA2
compatibility, legacy `/resource/` endpoint compatibility, or protocol
compatibility. Promise wrappers reject with the same native typed errors as the
underlying Effect program, but TypeScript does not type Promise rejection
channels.

| Native operation | Compat wrapper | Options |
| --- | --- | --- |
| `queryRows` | `querySoda3Rows` | `Soda3CompatOptions` |
| `queryAllRows` | `queryAllSoda3Rows` | `Soda3CompatOptions` |
| `countRows` | `countSoda3Rows` | `Soda3CompatOptions` |
| `exportResponse` | `exportSoda3Response` | `Soda3CompatOptions` |
| `catalogSearch` | `searchSoda3Catalog` | `Soda3CompatOptions` |
| `fetchDatasetMetadata` | `fetchSoda3DatasetMetadata` | `Soda3CompatOptions` |
| `queryNycDotDataset` | `queryNycDotRows` | `Soda3CompatOptions` |
| `exportNycDotDataset` | `exportNycDotResponse` | `Soda3CompatOptions` |
| `queryNycOpenDataDataset` | `queryNycOpenDataRows` | `Soda3CompatOptions` |
| `exportNycOpenDataDataset` | `exportNycOpenDataResponse` | `Soda3CompatOptions` |
| `searchNycOpenDataCatalog` | `searchNycOpenData` | `Soda3CompatOptions` |
| `probeGtfsStatic` | `probeMtaGtfsStatic` | `MtaCompatOptions` |
| `fetchGtfsStaticResponse` | `fetchMtaGtfsStaticResponse` | `MtaCompatOptions` |
| `fetchGtfsStatic` | `fetchMtaGtfsStaticBytes` | `MtaCompatOptions` |
| `probeGtfsRealtime` | `probeMtaGtfsRealtime` | `MtaCompatOptions` |
| `captureGtfsRealtime` | `captureMtaGtfsRealtime` | `MtaCompatOptions` |
| `fetchMtaJsonDirect` | `fetchMtaJsonDirect` | `MtaCompatOptions` |
| `queryMtaOpenData` | `queryMtaOpenDataRows` | `Soda3CompatOptions` |

Native-only surfaces include synchronous descriptor lookup helpers and low-level
Effect-native decoder helpers.

`Soda3CompatOptions` accepts `appToken`, `retryTimes`, `retryDelayMs`,
`timeoutMs`, and custom `fetch`. `MtaCompatOptions` accepts `retryTimes`,
`retryDelayMs`, `timeoutMs`, custom `fetch`, and an optional GTFS realtime
decoder. `timeoutMs` remains a total budget covering all retry attempts.

Compat error guards by family:

| Family | Guard | Error tags |
| --- | --- | --- |
| SODA3 | `isSoda3ClientError` | `InvalidInputError`, `ProviderHttpError`, `ProviderContractError`, `TimeoutError`, `RetryExhaustedError` |
| MTA | `isMtaError` | `MtaHttpError`, `MtaDecodeError`, `MtaInvalidInputError`, `MtaTimeoutError`, `MtaRetryExhaustedError` |
| NYC DOT descriptors | `isUnsupportedDatasetError` | `UnsupportedDatasetError` |

`isTransitKitCompatError` composes those native guards. It narrows errors
created by this package family; it is not a loose structural check for arbitrary
objects that happen to contain a matching `_tag`.

Promise compat example:

```ts
import { isTransitKitCompatError } from "@nyc-transit-kit/compat/errors"
import { queryNycDotRows } from "@nyc-transit-kit/compat/nyc-dot"

try {
  const rows = await queryNycDotRows({
    name: "traffic-speeds",
    query: "SELECT *"
  })
  rows.rows
} catch (error) {
  if (isTransitKitCompatError(error)) {
    error._tag
  }
}
```

## `@nyc-transit-kit/cli`

`@nyc-transit-kit/cli` owns the Bun CLI package. Public package constants are
`packageName` and `localBinaryName`. The current binary names are `ntk` and
`nyc-transit`.

| Import path | Purpose |
| --- | --- |
| `@nyc-transit-kit/cli` | CLI package constants for tooling. |

CLI configuration:

| Environment variable | Required | Purpose |
| --- | --- | --- |
| `SOCRATA_APP_TOKEN` | No | Optional Socrata app token for CLI Socrata-backed requests. Only `packages/cli` reads CLI environment variables; core packages receive explicit config. |

Current command surfaces include:

```sh
ntk --version --json
ntk socrata query --domain data.cityofnewyork.us --dataset ycrg-ses3 --select "*" --json --dry-run
ntk socrata export --domain data.cityofnewyork.us --dataset ycrg-ses3 --format csv --output /tmp/rows.csv --json --dry-run
ntk socrata range-probe --domain data.ny.gov --dataset f462-ka72 --format csv --range-end 63 --json --dry-run
ntk catalog search --domain data.cityofnewyork.us --query "bus lanes" --json --dry-run
ntk nyc-open-data catalog search --query "bus lanes" --json --dry-run
ntk nyc-open-data dataset list --json
ntk nyc-open-data dataset query --dataset ycrg-ses3 --select "*" --json --dry-run
ntk nyc-open-data dataset export --dataset ycrg-ses3 --format csv --output /tmp/rows.csv --json --dry-run
ntk nyc-dot dataset list --json
ntk nyc-dot dataset info --name bus-lanes-local-streets --json
ntk nyc-dot dataset info --name traffic-speeds --json
ntk nyc-dot dataset query --name traffic-speeds --select "*" --json --dry-run
ntk nyc-dot dataset export --name traffic-speeds --format csv --output /tmp/dot.csv --json --dry-run
ntk mta open-data dataset list --json
ntk mta open-data dataset info --dataset f462-ka72 --json
ntk mta open-data dataset query --dataset f462-ka72 --select "*" --json --dry-run
ntk mta gtfs-static list --json
ntk mta gtfs-static probe --feed subway-regular --json --dry-run
ntk mta gtfs-static fetch --feed subway-regular --output /tmp/feed.zip --json --dry-run
ntk mta gtfs-rt list --json
ntk mta gtfs-rt probe --feed subway-1234567 --json --dry-run
ntk mta gtfs-rt decode --feed alerts-all --json --dry-run
ntk mta gtfs-rt capture --feed alerts-all --output /tmp/alerts.pb --manifest-output /tmp/alerts.manifest.json --json --dry-run
```

Generic SODA3 commands are the universal escape hatch for any Socrata-backed
dataset id. Provider commands add domain defaults, curated descriptors, and
friendlier names. Typed adapters are intentionally narrower than generic access.
Bus Time SIRI CLI commands are not part of v0; Bus Time is available through
the API-key-aware raw MTA JSON direct client surface.

The CLI command tree uses Effect 4 beta's built-in unstable CLI modules from
`effect/unstable/cli/*`. Do not install the separate `@effect/cli` package while
it peers the Effect 3 line.

## `@nyc-transit-kit/fixtures`

`@nyc-transit-kit/fixtures` contains tiny public or synthetic fixtures for docs,
tests, and examples. It is not a mirror of full provider datasets.

| Import path | Purpose |
| --- | --- |
| `@nyc-transit-kit/fixtures` | Synthetic fixture constants. |

Current exports include `packageName`, `fixturePolicy`,
`sampleSocrataDatasetId`, `sampleSocrataDomain`, `sampleSoda3QueryResponse`,
`sampleSocrataCatalogResponse`, `sampleMtaOpenDataCatalogRow`, and
`sampleMtaElevatorEscalatorCurrentJson`,
`sampleGtfsRealtimeFeedMessageBase64`, and
`sampleGtfsRealtimeFeedMessageBytes`.
