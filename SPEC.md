# nyc-transit-kit SPEC

Last updated: 2026-06-15

## Mission

Build `nyc-transit-kit`: an Effect-native TypeScript monorepo for official NYC
and MTA transit data APIs.

This is not a 1:1 extraction from another repository. Design the toolkit as its
own public product, organized around official API/provider families, with a
small reusable library surface, deterministic fixtures, and a curated CLI.

The toolkit should be useful to:

- transit-data developers who want typed clients for official NYC/MTA data.
- analysts who want a reliable CLI for probing, querying, and exporting public
  datasets.
- downstream applications that want to depend on official API clients without
  inheriting a product-specific pipeline.

## Non-Negotiable Decisions

1. **Effect-native implementation**
   - Use `effect/Schema` as the runtime schema source of truth.
   - Use Effect services/layers for clients and runtime dependencies.
   - Use typed errors instead of broad thrown `Error` values inside core code.
   - Use Effect schedules/timeouts/concurrency for retry and resilience.
   - Use the pinned Effect 4 beta's built-in unstable CLI modules from
     `effect/unstable/cli/*` for the CLI. Do not install the separate
     `@effect/cli` package until a release compatible with the Effect 4 beta
     line exists.
   - Use `@effect/platform-bun` for Bun filesystem/terminal integration.

2. **Official API/provider package layout**
   - Package boundaries are based on official APIs and providers, not on a
     downstream app's internal modules.
   - The generic Socrata SODA3 client is its own package.
   - MTA, NYC Open Data, and NYC DOT are separate family packages.

3. **SODA3-only for Socrata-backed datasets**
   - Support SODA3 query/export/catalog patterns only.
   - Do not implement SODA2 helpers.
   - Do not add `/resource/<dataset>.json` builders, compatibility aliases, or
     fallback URL paths.
   - Tests must fail if SODA2 endpoint strings or SODA2 manifest fields are
     introduced.

4. **Bun-first, TypeScript-only**
   - Use Bun for package management, scripts, tests, and binary compilation.
   - Do not add pnpm, Python, FastAPI, hosted databases, or VPS assumptions.

5. **Public-package hygiene from day one**
   - No workspace-private dependencies in publishable package archives.
   - No `file:` dependencies in publishable packages.
   - No private paths, source maps with local absolute paths, `.env`, secrets,
     `node_modules`, or unrelated repo artifacts in package tarballs.
   - Optimize for tree shaking with subpath exports, internal subpath imports,
     function-first public APIs, and deep Effect module imports when supported.
     Package-root exports are compatibility and high-level convenience surfaces,
     not the only intended import path.

## Reference Docs To Check Before Implementation

Effect APIs move. Before choosing exact APIs, verify current official docs:

- Effect intro: https://effect.website/docs/getting-started/introduction/
- Effect Schema: https://effect.website/docs/schema/introduction/
- Effect Platform: https://effect.website/docs/platform/introduction/
- Effect CLI README: https://github.com/Effect-TS/effect/blob/main/packages/cli/README.md
- Socrata/SODA3 docs: https://dev.socrata.com/docs/
- Socrata app tokens: https://dev.socrata.com/docs/app-tokens
- MTA developer resources: https://www.mta.info/developers
- MTA open data: https://www.mta.info/open-data
- NYC Open Data developer docs: https://dev.socrata.com/foundry/data.cityofnewyork.us/

Record any important verified provider facts in `docs/official-api-map.md`.

## Target Monorepo Layout

Use this structure:

```text
nyc-transit-kit/
  SPEC.md
  README.md
  LICENSE
  package.json
  bun.lock
  tsconfig.base.json
  biome.jsonc

  docs/
    official-api-map.md
    product-boundary.md
    downstream-adapters.md
    release.md

  packages/
    contracts/
    soda3/
    mta/
    nyc-open-data/
    nyc-dot/
    cli/
    compat/
    fixtures/

  tests/
    package-archives/
    architecture/
```

## Package Responsibilities

### `packages/contracts`

Shared public contracts implemented with `effect/Schema`.

Owns:

- branded identifiers such as `SocrataDatasetId`, `ApiFamily`, `IsoDate`,
  `GtfsFeedKind`.
- SODA3 query/export/catalog request and response schemas.
- MTA GTFS static and GTFS Realtime probe/result schemas.
- NYC Open Data and NYC DOT dataset descriptor schemas.
- CLI JSON success/error envelopes.
- `CliReleaseManifest` schema.
- JSON Schema generation helpers, if needed by docs/release tooling.

Does not own:

- HTTP fetch logic.
- filesystem writes.
- provider credentials.
- product-specific transit metrics or analytics.

### `packages/soda3`

Generic Socrata SODA3 client and helpers.

Owns:

- SODA3 query endpoint construction.
- SODA3 export endpoint construction.
- catalog search/info helpers.
- SoQL helper functions.
- app-token header wiring from explicit config.
- retry/backoff/timeout behavior using Effect.
- raw export response/stream access for CLI downloads and range probes.
- typed provider errors.

Hard rule:

- No SODA2 support. No `/resource/<dataset>.json` strings.

### `packages/mta`

MTA official API clients/contracts.

Owns:

- GTFS static fetch/probe helpers.
- GTFS Realtime fetch/probe/decode helpers.
- decoder injection for tests and protocol fixtures.
- MTA Open Data dataset descriptors for transit datasets.
- SODA3-backed access to MTA Open Data datasets via `packages/soda3`.

Does not own:

- app-specific route scoring.
- local database writes.
- downstream product route briefs or detector logic.

### `packages/nyc-open-data`

NYC Open Data catalog and dataset helpers.

Owns:

- known NYC Open Data domain defaults.
- catalog/dataset descriptor helpers.
- SODA3-backed query/export helpers through `packages/soda3`.
- public fixture descriptors for common datasets used in tests/examples.

Hard rule:

- Socrata-backed access remains SODA3-only.

### `packages/nyc-dot`

NYC DOT official transit/street dataset descriptors and adapters.

Owns:

- DOT dataset descriptors.
- thin typed adapters for DOT datasets hosted through NYC Open Data.
- SODA3-backed helpers through `packages/soda3`.

Does not own:

- causal analysis.
- route performance scoring.
- geospatial joins beyond simple provider DTO normalization.

### `packages/cli`

Curated public CLI built with Effect 4 beta's built-in unstable CLI modules
from `effect/unstable/cli/*`.

Owns:

- command tree grouped by official API family.
- human output and `--json` output.
- CLI-level config/env reading.
- CLI-level secret redaction.
- atomic file downloads.
- binary version/build metadata output.

Every command must support `--json`.

### `packages/compat`

Optional non-Effect facade for normal Promise-based consumers.

Owns:

- thin Promise wrappers over Effect programs.
- no independent business logic.
- no separate retry, schema, or client implementation.

Example shape:

```ts
// Effect-native API
const program = Soda3.queryRows(input);

// compat API
const rows = await querySoda3Rows(input);
```

It is acceptable to postpone this package until the Effect-native API feels
stable, but keep the package slot reserved.

### `packages/fixtures`

Tiny public fixtures and test material.

Owns:

- canned SODA3 query responses.
- canned Socrata catalog responses.
- tiny GTFS static snippets.
- tiny GTFS Realtime protobuf samples where licensing permits.
- example dataset descriptors.
- expected CLI JSON outputs.

Fixtures must be small, public, and safe to publish.

## Initial Public CLI

Use a single binary. The exact name needs human approval before publish. Until
then, use `nyc-transit` or `ntk` as a local placeholder.

Initial command set:

```text
<binary> socrata query \
  --domain <domain> \
  --dataset <id> \
  --select <soql> \
  --json

<binary> socrata export \
  --domain <domain> \
  --dataset <id> \
  --format csv \
  --output <path> \
  --json

<binary> socrata range-probe \
  --domain <domain> \
  --dataset <id> \
  --format csv \
  --range-end <n> \
  --json

<binary> catalog search \
  --domain <domain> \
  --query <text> \
  --json

<binary> mta gtfs-static fetch \
  --url <url> \
  --output <path> \
  --json

<binary> mta gtfs-rt probe \
  --feed <vehicle-positions|trip-updates|alerts> \
  --json

<binary> nyc-open-data dataset info \
  --dataset <id> \
  --json

<binary> nyc-dot dataset info \
  --name <known-dataset> \
  --json
```

CLI requirements:

- `--json` is the stable agent/programmatic contract.
- human output should be readable but is not the compatibility contract.
- commands that write files must use temp-file write + atomic rename.
- write commands should support `--dry-run` where meaningful.
- secret values must never be printed.
- CLI may read env vars, but core client packages must receive explicit config.

## Error Model

Core packages should use typed errors. Define public error classes/data types
with Effect Schema where useful.

Minimum error families:

- `InvalidInputError`
- `ProviderHttpError`
- `ProviderContractError`
- `TimeoutError`
- `RetryExhaustedError`
- `DecodeError`
- `FilesystemError`
- `UnsupportedDatasetError`
- `MissingCredentialError`

CLI JSON errors should use a stable envelope:

```ts
type CliErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    provider?: string;
    retryable?: boolean;
  };
};
```

Success envelopes should include enough metadata for downstream automation:

```ts
type CliSuccessEnvelope<T> = {
  ok: true;
  data: T;
  meta: {
    generatedAt: string;
    apiFamily: string;
    schemaVersion: string;
  };
};
```

## Implementation Plan

### Step 1: Create project boundary docs

Create:

- `README.md`
- `docs/product-boundary.md`
- `docs/official-api-map.md`

`docs/product-boundary.md` must state:

- repo name: `nyc-transit-kit`.
- package structure by official API/provider family.
- Effect-native primary API.
- Promise compat wrappers are optional facades over Effect programs.
- SODA3-only rule for all Socrata-backed datasets.
- private downstream product logic is out of scope.

`docs/official-api-map.md` must list:

- Socrata SODA3 generic API.
- MTA developer resources to support in v0.
- MTA Open Data surfaces to support in v0.
- NYC Open Data surfaces to support in v0.
- NYC DOT dataset surfaces to support in v0.
- for each API family, whether it is Socrata-backed.

Verify:

```sh
test -f docs/product-boundary.md
test -f docs/official-api-map.md
```

### Step 2: Scaffold the monorepo

Create root config:

- `package.json`
- `tsconfig.base.json`
- `biome.jsonc`
- `.gitignore`
- `LICENSE`

Root `package.json` should be private and Bun-first:

```json
{
  "name": "nyc-transit-kit",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "check": "bun run check:types && bun run check:style && bun test && bun run check:package",
    "check:types": "tsc -b packages/*",
    "check:style": "biome check .",
    "check:style:write": "biome check --write .",
    "check:package": "bun run tests/package-archives/check-package-archives.ts",
    "cli": "bun run packages/cli/src/main.ts",
    "build": "bun run packages/cli/scripts/build.ts",
    "build:cli": "bun run packages/cli/scripts/build-binary.ts"
  }
}
```

Exact scripts may change, but the root must have one-command checks.

Add dependencies:

- `effect`
- `@effect/platform`
- `@effect/platform-bun`
- `@effect/platform-node` only if uncompiled Node runtime is supported.
- `typescript`
- `@biomejs/biome`

Pin exact Effect-related versions at first. Do not use broad ranges until
upgrade tests exist.

Verify:

```sh
bun install
bun run check:types
bun test
bun run check:style
```

Expected: all commands exit 0.

### Step 3: Implement `packages/contracts`

Create package:

```text
packages/contracts/
  package.json
  tsconfig.json
  src/
    ids.ts
    soda3.ts
    mta.ts
    nyc-open-data.ts
    nyc-dot.ts
    cli.ts
    release.ts
    index.ts
  test/
    ids.test.ts
    soda3.test.ts
    cli.test.ts
```

Rules:

- Use `effect/Schema`.
- Export explicit named values only.
- No wildcard barrels.
- No network, filesystem, CLI, or provider SDK logic.

Tests:

- valid/invalid Socrata dataset IDs.
- valid/invalid API-family IDs.
- SODA3 endpoint/request schemas decode.
- CLI success/error envelopes decode.
- SODA2-like endpoint fields are rejected.

Verify:

```sh
bun test packages/contracts
bun run check:types
```

Expected: all pass.

### Step 4: Implement `packages/soda3`

Create package:

```text
packages/soda3/
  package.json
  tsconfig.json
  src/
    client.ts
    catalog.ts
    endpoints.ts
    errors.ts
    soql.ts
    index.ts
  test/
    client.test.ts
    catalog.test.ts
    endpoints.test.ts
    soql.test.ts
```

Implementation requirements:

- Use Effect services/layers for fetch/config/clock.
- Accept app token explicitly through config/service.
- Do not read env vars in `packages/soda3`.
- Implement query/export/catalog helpers.
- Implement retry/backoff/timeout through Effect.
- Return typed errors.
- Provide tests with injected fetch.
- Keep raw export response access available.
- Hard-fail tests if `/resource/` appears in package source.

Required test cases:

- query URL/body uses SODA3.
- export URL/body uses SODA3.
- catalog search parses fixture.
- app token sent in header when provided.
- app token not printed/redacted in errors.
- transient failures retry.
- retry exhaustion returns typed error.
- range headers are forwarded for export probes.
- `/resource/` scan returns zero matches.

Verify:

```sh
bun test packages/soda3
bun run check:types
rg -n "/resource/|SODA2|soda2" packages/soda3/src && exit 1 || true
```

Expected: tests pass; scan finds no forbidden source matches.

### Step 5: Implement `packages/mta`

Create package:

```text
packages/mta/
  package.json
  tsconfig.json
  src/
    gtfs-static.ts
    gtfs-realtime.ts
    open-data.ts
    datasets.ts
    errors.ts
    index.ts
  test/
    gtfs-static.test.ts
    gtfs-realtime.test.ts
    open-data.test.ts
```

Implementation requirements:

- GTFS static fetch/probe helpers.
- GTFS Realtime fetch/probe/decode helpers.
- decoder injection for tests.
- MTA Open Data dataset descriptors.
- Socrata-backed MTA Open Data access delegates to `packages/soda3`.
- No route scoring, analytics, local DB, or downstream product logic.

Verify:

```sh
bun test packages/mta
bun run check:types
rg -n "/resource/|SODA2|soda2" packages/mta/src && exit 1 || true
```

Expected: tests pass; no forbidden SODA2 source strings.

### Step 6: Implement `packages/nyc-open-data`

Create package:

```text
packages/nyc-open-data/
  package.json
  tsconfig.json
  src/
    datasets.ts
    catalog.ts
    descriptors.ts
    index.ts
  test/
    datasets.test.ts
    catalog.test.ts
```

Implementation requirements:

- known domain defaults.
- dataset descriptor helpers.
- SODA3-backed query/export via `packages/soda3`.
- no SODA2 helpers.

Verify:

```sh
bun test packages/nyc-open-data
bun run check:types
rg -n "/resource/|SODA2|soda2" packages/nyc-open-data/src && exit 1 || true
```

Expected: tests pass; no forbidden SODA2 source strings.

### Step 7: Implement `packages/nyc-dot`

Create package:

```text
packages/nyc-dot/
  package.json
  tsconfig.json
  src/
    datasets.ts
    bus-lanes.ts
    traffic-speeds.ts
    traffic-volume.ts
    street-permits.ts
    index.ts
  test/
    datasets.test.ts
```

Implementation requirements:

- DOT dataset descriptors.
- thin DTO adapters for common DOT public datasets.
- SODA3-backed query/export through `packages/soda3` where hosted on NYC Open
  Data.
- no geospatial analysis beyond simple provider DTO normalization.

Verify:

```sh
bun test packages/nyc-dot
bun run check:types
rg -n "/resource/|SODA2|soda2" packages/nyc-dot/src && exit 1 || true
```

Expected: tests pass; no forbidden SODA2 source strings.

### Step 8: Implement `packages/fixtures`

Create package:

```text
packages/fixtures/
  package.json
  README.md
  soda3/
  mta/
  nyc-open-data/
  nyc-dot/
```

Rules:

- Fixtures must be small.
- Fixtures must be public or synthetic.
- Do not commit full raw datasets.
- Do not commit secrets.
- Document source and license/provenance where fixtures are copied from public
  providers.

Verify:

```sh
bun test packages/fixtures
bun run tests/architecture/check-fixtures.ts
```

Expected: fixtures are small and contain no secret-like content.

### Step 9: Implement `packages/cli`

Create package:

```text
packages/cli/
  package.json
  src/
    main.ts
    commands/
      socrata.ts
      catalog.ts
      mta.ts
      nyc-open-data.ts
      nyc-dot.ts
    output.ts
    config.ts
    errors.ts
  test/
    cli.test.ts
  scripts/
    build.ts
    build-binary.ts
```

Implementation requirements:

- Use `effect/unstable/cli/*` from the pinned Effect 4 beta. Do not install the
  separate `@effect/cli` package while it peers the Effect 3 line.
- Use `@effect/platform-bun`.
- Every command supports `--json`.
- CLI may read env vars such as `SOCRATA_APP_TOKEN`.
- Core client packages must not read env vars.
- Downloads use temp-file + atomic rename.
- `--version --json` reports version, schema version, git SHA, and build
  target.

Verify:

```sh
bun run cli -- --help
bun run cli -- socrata query --help
bun run cli -- socrata range-probe --domain data.ny.gov --dataset kufs-yh3x --format csv --range-end 63 --json --dry-run
bun run cli -- mta gtfs-rt probe --feed vehicle-positions --json --dry-run
bun test packages/cli
```

Expected: help renders; dry-run JSON outputs parse through contract schemas;
tests pass.

### Step 10: Implement `packages/compat`

Create package:

```text
packages/compat/
  package.json
  src/
    soda3.ts
    mta.ts
    nyc-open-data.ts
    nyc-dot.ts
    index.ts
  test/
    compat.test.ts
```

Rules:

- Only Promise wrappers over Effect programs.
- No duplicate endpoint construction.
- No duplicate retry loops.
- No duplicate schema definitions.

Verify:

```sh
bun test packages/compat
bun run check:types
```

Expected: tests pass; wrapper functions call underlying Effect programs.

### Step 11: Add architecture and package archive checks

Add tests under:

```text
tests/architecture/
tests/package-archives/
```

Required checks:

- no wildcard package barrels.
- packages with multiple public modules expose subpath exports.
- internal package code uses subpath imports instead of package-root barrels.
- source imports Effect modules through deep `effect/<Module>` paths when those
  modules are available.
- no package imports downstream app internals.
- core packages do not read `process.env`.
- only `packages/cli` reads CLI env vars.
- no SODA2 endpoint support.
- package archives contain no:
  - `workspace:`
  - `file:`
  - `node_modules`
  - `.env`
  - `.github`
  - private absolute paths
  - source maps with private paths
  - unrelated repo artifacts

Verify:

```sh
bun run check:package
bun test tests/architecture
```

Expected: all pass.

### Step 12: Add binary build and release manifest

Implement:

- `packages/contracts/src/release.ts` with `CliReleaseManifest`.
- `packages/cli/scripts/build-binary.ts`.
- `docs/release.md`.

First release target can be a local dry run only. Do not publish yet.

Required manifest fields:

```ts
type CliReleaseManifest = {
  manifestVersion: 1;
  packageName: string;
  version: string;
  schemaVersion: string;
  schemaCommit: string;
  generatedSourceCommit: string;
  builtAt: string;
  artifacts: Array<{
    platform: "darwin" | "linux" | "win32";
    arch: "arm64" | "x64";
    libc?: "glibc" | "musl";
    url: string;
    sha256: string;
    size: number;
    signed: boolean;
    notarized?: boolean;
  }>;
};
```

Verify:

```sh
bun run build:cli
./dist/<binary> --version --json
bun run check:package
```

Expected: binary runs and version JSON validates.

### Step 13: Document downstream adapters

Create `docs/downstream-adapters.md`.

It should explain how downstream projects can consume the toolkit without
making their product-specific code part of this repo.

Include:

- import examples for Effect-native API.
- import examples for Promise compat API.
- guidance for replacing existing local source clients.
- what downstreams should keep local: analytics, DB projections, route scoring,
  detector logic, product-specific briefs, app-specific UI.

Verify:

```sh
test -f docs/downstream-adapters.md
```

Expected: file exists and does not mention private paths as required inputs.

## Done Criteria

All must be true:

- `nyc-transit-kit` is a standalone monorepo.
- package layout is organized by official API/provider family.
- Effect is the implementation model across contracts, clients, and CLI.
- Socrata-backed datasets support SODA3 only.
- all packages have tests.
- all CLI commands support `--json`.
- default tests are fixture-backed and do not require live network.
- package archive checks pass.
- CLI binary builds and reports version JSON.
- docs explain product boundary, official API map, release process, and
  downstream adapters.

Verification:

```sh
bun install
bun run check:types
bun run check:style
bun test
bun run check:package
bun run build:cli
./dist/<binary> --version --json
```

Expected: all commands exit 0.

## STOP Conditions

Stop and report back if:

- A needed official API cannot be verified from official docs.
- Supporting a provider requires SODA2.
- A package starts mirroring a downstream app's internal modules.
- `@bp/*` or any downstream app workspace dependency becomes necessary.
- a core package needs to read `process.env`.
- default tests require live network.
- fixtures would require committing a large raw dataset.
- package archive audit finds secrets, local absolute paths, `workspace:`,
  `file:`, or unrelated repo artifacts.
- Effect CLI/platform APIs cannot support Bun after pinning tested versions.
- the public CLI starts growing private product verbs such as detector runs,
  route scoring, D1/R2 publish, route briefs, or document extraction.

## Deferred Work

Do not do these in v0 unless explicitly approved:

- npm publication.
- Homebrew tap.
- PyPI wheels.
- Windows package managers.
- browser bundle support beyond pure helper modules.
- hosted services.
- live-source CI.
- app-specific transit analytics.

## Notes For The First Agent

Start with `docs/product-boundary.md` and `docs/official-api-map.md`. Do not
write much code until the API family map and SODA3-only policy are committed.

Then scaffold the monorepo and implement `packages/contracts` plus
`packages/soda3` first. The rest of the packages should depend on those rather
than inventing parallel HTTP or schema layers.

Keep the first pass small. A boring, well-tested SODA3 client plus one CLI
command is a better foundation than a broad but leaky toolkit.
