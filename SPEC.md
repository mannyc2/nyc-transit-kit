# nyc-transit-kit SPEC

The decisions that stand until someone reverses them here, one line each. The
code and its tests hold the detail. Last updated 2026-11-02 for 0.3.1.

## Mission

Typed, Effect-native access to official NYC and MTA transit data: libraries for
developers, a CLI for analysts and agents, and official clients that downstream
apps can depend on without inheriting anyone's product pipeline.

## Layout

- `apps/` holds what deploys: `apps/cli`, the `ntk` binary. `packages/` holds
  libraries. An app may depend on packages; a package never depends on an app.
- Packages follow the official provider. `soda3` is Socrata on any domain:
  SODA3, Discovery and SoQL. `mta` is the MTA's feeds and its datasets on NYS
  Open Data. `nyc-open-data` is NYC Open Data, NYC DOT included. `fixtures` is
  real samples and the HTTP test layer.
- A schema lives in the module of the provider that defines it. There is no
  shared contracts package.
- A module is one PascalCase file, imported as a namespace:
  `import * as Soql from "@nyc-transit-kit/soda3/Soql"`. Each package's
  `index.ts` re-exports its modules as namespaces, and nothing else.

## Sources

- Socrata access is SODA3 only: `query.json`, `export.csv` and the Discovery
  API. No SODA2, no `/resource/` URLs, no fallbacks. An architecture test fails
  on either string.
- SODA3 query and export refuse requests without an app token, so
  `Soda3Client.layer` requires one. Discovery needs none.
- SoQL is built as `effect/sql` Statement fragments and compiled to text with
  every value written as a SoQL literal. SODA3 `parameters` bind only in
  parameterized views, and `:name` in SoQL names a system column.
- A curated dataset carries the schema of one full row, checked against real
  rows. Any other dataset is reachable by id through `soda3`.
- Provider facts that took a live request to learn go in
  `docs/official-api-map.md`, dated.

## Effect

- Effect 4.0.6 stable. Libraries take `effect` as a peer (`^4.0.6`) so an app
  never loads two copies; the CLI pins it exactly, with every Effect platform
  package it loads, because those only range each other.
- The installed `node_modules/effect` is the API authority: its `AGENTS.md` and
  declarations, not a vendored checkout or memory of the betas.
- Libraries require `HttpClient` and choose no transport, retry or timeout.
  Callers compose `HttpClient.retryTransient`, `Effect.retry` and
  `Effect.timeout`.
- Libraries take values, never the environment: no `process.env`, `Config` or
  `ConfigProvider` outside `apps/cli`.
- Errors are `Schema.TaggedError`s that keep the provider's own sentence, such as
  Socrata's "This request must be authenticated or have an application token".
- Service keys are `@nyc-transit-kit/<workspace>/<ClassName>`.
- The lint guards in `tests/architecture/package-boundaries.test.ts` are the
  design guide's table: no `as unknown as`, no wall-clock reads, no module `let`,
  no `Effect.promise`, no `new Error`, no `Effect.run*`, no global `fetch`.

## CLI

- One binary, `ntk`, on `effect/cli`. No hand-rolled argv parsing.
- `--json` writes exactly one envelope to stdout, `--help` included. Readable
  output is not a contract.
- `schemaVersion` changes whenever the envelope or an error code changes; the
  package version moves on its own.
- Error codes are a closed table in `apps/cli/src/Output.ts`. A new error type
  does not compile until it has a code.
- Files are streamed to `<path>.partial` and renamed. A failed run leaves no
  file and touches no destination.
- `--dry-run` swaps in an HttpClient that records and a FileSystem that writes
  nothing. The same command code runs; tokens print as `<redacted>`.
- The CLI retries transient failures (network, 408, 429, 5xx) twice and honours
  `Retry-After`. It sends no trace headers to providers.
- The CLI is the only reader of `SOCRATA_APP_TOKEN`.

## Packages and release

- Every public module of a package is a subpath export. Sibling packages are
  imported by subpath, Effect by module (`effect/Effect`).
- Packages are source-first: exports point at `.ts`. Moving to built JS is a
  separate decision.
- Packed manifests contain no `workspace:`, `catalog:`, `file:` or local paths.
  Internal dependencies are literal release versions.
- The CLI's npm bin is `src/bin.ts`, run by Bun through its shebang.
- Releases go through the reviewed `release.yml` run with npm trusted
  publishing, never on a bare tag push.
- The release runner lives in `tools/release` with its own lockfile.
  `ts-release` 0.0.7 is built on an Effect beta and crashes when mixed with
  4.0.6. Moving to `ts-release` 0.4, which peers Effect 4.0, retires it.

## Testing

- Tests are `@effect/vitest`, run in Bun by `bun --bun vitest run`. Effect code
  is tested with `it.effect`, which supplies `TestClock` and `TestConsole`.
- HTTP is tested through `HttpTest.layer`, an `HttpClient` built from a handler
  that records every request. Code under test keeps its real client.
- Time is tested with `TestClock`: backoff and `Retry-After` are asserted by
  moving the clock, never by sleeping.
- Samples are real responses, cut down. Never hand-write one: a made-up row
  matches a made-up schema.
- A fake refuses what the provider refuses. Without a token, `HttpTest.soda3`
  answers with Socrata's real 403; for `export.json`, `export.geojson` and
  paging with `orderingSpecifier: "discard"`, with SODA3's real 406 and 400.
- Tests run the real component. The CLI test drives `Cli.run` with test Stdio,
  Console, environment and HTTP.
- Each fix gets a mutation check: undo it and watch a test fail.

## Out of scope

- Product analytics, route scoring, detectors, briefs, hosted pipelines and app
  UI stay downstream; see `docs/product-boundary.md`.
- Mirroring every NYC Open Data dataset as curated constants. Generic SODA3
  access already covers the domain.
- A Promise facade. `Effect.runPromise` at the caller's edge is one line, and a
  second API doubles every change.
- Hashing every download. That needs a streaming design first.
- A fetch-level token helper. `Soda3Client.layer` already takes the token.

## Waiting on product sign-off

Each of these removes published surface, and there is no evidence about its
users either way. None happens without a yes.

- Drop the SoQL window helpers: `Soql.monthWindow`, `Soql.dateWindow`,
  `Soql.timestampRange`, `Soql.monthRange` and `Soql.yearMonthRange`.
- Drop `ntk socrata range-probe`.
- Collapse the per-provider `dataset` command trees into `ntk socrata`.
- Drop the typed row schemas for curated datasets.
- Drop GTFS-realtime capture.
- Deprecate `@nyc-transit-kit/compat`, `@nyc-transit-kit/contracts` and
  `@nyc-transit-kit/nyc-dot` on npm. They left the workspace in 0.3.0; 0.2.0
  stays installable.

## Reversed in 0.3.0

- The CLI moved from `packages/cli` to `apps/cli`: it deploys, and nothing
  depends on it.
- `@nyc-transit-kit/contracts` dissolved into the provider modules that own each
  schema, and `@nyc-transit-kit/nyc-dot` became `NycDot` in `nyc-open-data`: one
  package per provider, not per publisher.
- The hand-written SoQL builder became `effect/sql` Statement fragments. Its
  `:name` placeholders asked SODA3 to bind parameters it binds only in
  parameterized views; values are now SoQL literals.
- `bun test` became `@effect/vitest`, `answeringFetch` became `HttpTest.layer`,
  and the retry test that slept through real backoff moves `TestClock` instead.
- Kebab-case modules (`soql.ts`, `gtfs-realtime.ts`) became PascalCase
  namespaces (`Soql`, `GtfsRealtime`), and prefixed names lost their prefix:
  `soqlEq` is `Soql.eq`, `decodeFeedMessage` is `GtfsRealtime.decode`.
- A curated `Dataset` is a `DatasetRef`: its id is `datasetId`, not `id`.
- The CLI's npm bin wrappers, which imported a `main` that did not exist, are
  gone; the bin is `src/bin.ts`.
- The `GtfsRealtimeDecoder` service and its `Passthrough` layer became one
  function, `GtfsRealtime.decode`. Tests decode real feed bytes instead of
  passing them through.
- The hand-written fixtures, once "left alone", became real responses. The old
  ones hid wrong row field names and the `null` attribution that real
  Discovery results carry and the old schema refused.
- `effect` moved from an exact dependency to a peer, as recorded when 4.0
  stabilised.
- Descriptor metadata (`lastVerified`, `tags`, `adapterStatus`) is gone.
  Provenance belongs to git and CI, not to constants.
- Package-level retry and timeout options (`retryTimes` and the like) are gone.
  Callers compose them.
- `ntk mta gtfs-rt decode` now prints every entity; it used to repeat `probe`.
