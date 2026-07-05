# Plans

Two program generations live in this index:

1. **Semantic-compression program (2026-07-05, plans 047-056)** — ACTIVE.
   Reduce the durable core from ~5,915 package-source LOC toward the smallest
   version that preserves behavior, package boundaries, the `--json` CLI
   contract, and the release gates. Start here.
2. **0.1.x build-out program (plans 001-046)** — all DONE; kept below as
   history and as the record of decided tradeoffs.

The 2026-07-05 maintainer directive explicitly selected **all** high-leverage
semantic-compression findings for planning (no interactive triage), set
aggressive per-package sLOC budgets as forcing functions, and authorized
public-API shrinkage within the 8 existing package boundaries. It also
**reverses** two previously recorded decisions (see "Reversed decisions").

## Diagnosis — why the monorepo grew

Verified against every source file at commit `8ea2c16` (v0.1.4, `bun test`
green: 176 tests / 14 files):

1. **File count = API surface.** The architecture rule
   (`tests/architecture/package-boundaries.test.ts:63-85`) requires every
   non-internal src file to be a package.json subpath export, which cascades
   into a downstream-strict import, an api-reference section, and often a
   compat wrapper + error re-export. 46 additive plans each added files, so
   the public surface compounded to 44 subpaths for ~5.9k LOC. Compression
   therefore = merging files by concept, which shrinks code AND API together.
2. **Validate-at-every-boundary ceremony.** The same 9-line
   `Schema.decodeUnknownEffect(...).pipe(catchTag("SchemaError" → typed
   error))` adapter appears ~23 times across soda3/mta/nyc-dot (soql.ts alone
   holds a factory + 8 aliases). One helper per package removes ~200 LOC.
3. **mta re-implements soda3's transport concerns** — retry/backoff/timeout
   policy, HTTP-error mapping, `toWebResponse`, fetch-layer construction,
   URL secret redaction (twice within mta), `httpStatusText` (×3 repo-wide).
4. **Hand-expanded CLI command families.** Four provider families each
   rebuild list/info/query/export with identical Flag ceremony; the dry-run
   flag is declared 13×; five exported `*CommandPaths` arrays are dead.
5. **Re-export layering.** contracts' 130-line root barrel exports every type
   twice (`X` + `XType`); compat re-exports the soda3 error list four times;
   `soda3/client.ts` exists only to re-export `internal/services.ts`;
   `nyc-open-data/datasets.ts` is a 3-line re-export file.
6. **Dead or test-only vocabulary.** `Soda3Operation`, `CliEnvelopeStatus`,
   `gtfsStaticSurface`/`gtfsRealtimeSurface`, three `@deprecated` DOT
   descriptors duplicating nyc-dot data, an empty generated registry feeding
   a lookup machine, `packages/cli/scripts/build.ts` placeholder.
7. **Longhand data.** `mta/internal/direct-feed-records.ts` spells out 30
   descriptor records (242 LOC) whose URLs are systematic.

## Active plans — execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| [047](047-cli-run-path-characterization.md) | CLI run-path characterization harness | P1 | M | — | DONE |
| [048](048-soda3-internal-consolidation.md) | soda3 internal consolidation + decode helper | P1 | M | — | DONE |
| [049](049-soql-implementation-compression.md) | SoQL implementation compression | P1 | M | 048 | DONE |
| [050](050-contracts-compression.md) | contracts compression + descriptors merge | P1 | M | — (after 048/049 preferred) | DONE |
| [051](051-shared-transport-policy.md) | Shared transport policy (`soda3/transport`) | P1 | M | 047, 048 | DONE |
| [052](052-mta-package-flatten.md) | mta flatten (14 files → 8, 11 subpaths → 7) | P1 | L | 047, 050, 051 | DONE |
| [053](053-provider-packages-flatten.md) | nyc-open-data + nyc-dot flatten | P1 | M | 050 | DONE |
| [054](054-compat-compression.md) | compat: one error surface, one runtime | P2 | S | 052, 053 | DONE |
| [055](055-cli-consolidation.md) | CLI consolidation (dataset-command builder) | P1 | L | 047, 052, 053 | DONE |
| [056](056-release-alignment-0-2-0.md) | 0.2.0 release + docs/SPEC alignment | P2 | M | 048-055 | DONE |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (reason) | REJECTED (rationale).

### Dependency notes

- **047 before anything that touches run paths** (051, 052, 055): today only
  dry-run CLI behavior is tested; 047 pins provider-call envelopes, typed
  error → envelope code mapping, and file-download metadata in-process.
- **048 before 049/051**: creates `internal/decode.ts` and consolidates
  soda3 transport internals that 049 consumes and 051 lifts.
- **050 before 052/053**: descriptor contracts move to
  `contracts/descriptors` once; mta/provider restructures then import the
  final paths (avoids double-touching generated records files).
- **052+053 before 054/055**: compat and CLI updates assume the final
  mta/provider subpaths.
- **056 last**: version bump, migration notes, SPEC/docs alignment, full
  `check:release-local`.
- Parallelism: {047, 048, 050} can run concurrently; then {049, 051, 053};
  then 052; then {054, 055}; then 056.

### Target architecture (post-056)

Eight packages, same boundaries, ~29 subpath exports (from 44), file trees:

```
contracts/src:  cli.ts descriptors.ts ids.ts index.ts metadata.ts mta.ts release.ts soda3.ts
soda3/src:      catalog.ts client.ts endpoints.ts errors.ts export.ts index.ts query.ts
                soql.ts transport.ts internal/{decode,transport}.ts
mta/src:        client.ts errors.ts feeds.ts gtfs-realtime.ts gtfs-static.ts index.ts
                json-direct.ts open-data.ts internal/{decode,open-data-descriptor-records}.ts
nyc-open-data/src: client.ts descriptors.ts index.ts internal/descriptor-records.ts
nyc-dot/src:    datasets.ts index.ts rows.ts internal/descriptor-records.ts
cli/src:        build-info.ts files.ts index.ts main.ts runtime.ts
                commands/{root,shared,socrata,nyc-open-data,nyc-dot,mta}.ts (± datasets builder)
compat/src:     errors.ts index.ts mta.ts nyc-dot.ts nyc-open-data.ts soda3.ts internal/runtime.ts
fixtures/src:   index.ts (unchanged)
```

Invariants carried by the design (encoded in schemas/services, not defensive
code): branded ids validate once at request decode; per-package tagged error
families are the only failure channel; retry/timeout semantics live in one
policy engine (`soda3/transport`); descriptor data flows only through
`makeDescriptorRegistry` over script-generated records files; the CLI JSON
envelope is the only machine contract and `schemaVersion` tracks it.

### sLOC ledger (source only; tests/fixtures/scripts excluded)

| Package | Now | Directive budget | Plan target | If budget missed — what prevents it |
|---|---:|---:|---:|---|
| contracts | 759 | 300-400 | ~620 | Published schema surface: typed row adapters, widened catalog fields, CLI envelope + release manifest |
| soda3 | 1,115 | 450-650 | ~700-800 | SoQL helper family + query/export/catalog/metadata breadth; `transport` adds ~85 shared LOC that saves more in mta |
| mta | 1,237 | 350-550 | ~780 | Three protocol families (GTFS static, GTFS-RT probe/decode/capture, JSON direct) + ~150 LOC descriptor data even after builder compression |
| cli | 2,048 | 400-650 | ~950-1,050 | 18 documented commands, per-flag help, dry-run mode, CliError→JSON mapping, atomic downloads |
| compat | 305 | 80-150 | ~230 | Per-family subpaths + full wrapper matrix (37 wrappers) |
| nyc-dot | 209 | 80-140 | ~170 (≈128 logic) | 42 LOC generated descriptor data rides above budget |
| nyc-open-data | 153 | 70-120 | ~85 | met |
| fixtures | 89 | leave | 89 | unchanged |
| **Total** | **5,915** | **1,8k-2,6k** | **~3,050-3,250** | see "Deeper cuts" — sign-off cuts reach ~2,4k-2,7k |

### Deeper cuts requiring product sign-off

Each is deliberately **excluded** from plans 047-056 because it deletes
published API or documented CLI surface with no in-repo consumer evidence
either way. Approving items converts them into small follow-up plans:

1. Drop the SoQL window/date helper family (`socrataMonthWindow`,
   `socrataDateWindow`, `soqlTimestampRange`, `soqlMonthWindow`,
   `soqlYearMonthRange`): ~-90 LOC (soda3+tests+docs). Breaks published
   helpers added by plans 023/024; needs downstream-consumer evidence.
2. Drop `socrata range-probe`: ~-60. Removes a SPEC-listed CLI command.
3. Drop `mta gtfs-rt decode` (behaviorally identical to `probe` since plan
   014): ~-25. Removes a documented command.
4. Collapse `nyc-open-data`/`nyc-dot`/`mta open-data` dataset command trees
   into generic `socrata` commands: ~-170. Breaks the documented per-provider
   command tree.
5. Compat root-only exports (drop the 4 family subpaths): ~-60. Breaks
   documented import paths.
6. Delete typed row adapters (`NycDot*Row` + decoders,
   `MtaElevatorEscalatorCurrentRow` + decoder, `MtaOpenDataCatalogRow` +
   decoders): ~-140 across contracts/mta/nyc-dot/docs. Changes the
   provider-coverage matrix ("typed adapters: selected" → "none").
7. Drop the GTFS-RT capture surface (`captureGtfsRealtime`, capture
   manifest schema, `mta gtfs-rt capture`, compat wrapper): ~-180. Removes
   the plan-026 feature.
8. Trim descriptor metadata fields (`sourceUrl`/`tags`/`temporalFields`/
   `lastVerified`): ~-80. Weakens the provider-coverage evidence ritual.

All eight approved ≈ -800 LOC → ~2,4k total. Reaching the 1.8k floor would
additionally require dropping a whole surface (JSON-direct/Bus Time family,
or the compat package's breadth) — not recommended without user research.

### Reversed decisions (was rejected/decided, now overridden)

- "Consolidating provider CLI command handlers beyond plan 018 … the
  residual per-provider similarity is the repo's explicit small-files style"
  (2026-07-04 audit) — **reversed** by the 2026-07-05 compression directive;
  plan 055 consolidates via a dataset-command builder.
- Plan 038's convenience of re-exporting error classes from every compat
  family module — **narrowed** to root + `/errors` by plan 054.
- Plan 003's small-files package structure — **superseded** by
  concept-per-file structure (plans 048, 052, 053).

### Newly considered and rejected (2026-07-05 audit)

- Unifying the soda3 and mta tagged-error families into one contracts-level
  family: rejected — breaks the published `_tag` contract and compat error
  docs for ~60 LOC; plan 051 captures the real duplication (policy engine).
- Hand-rolled argv parsing to shrink the CLI: rejected — architecture test
  bans it; SPEC non-negotiable keeps `effect/unstable/cli`.
- Moving mta feed-descriptor data into contracts or fixtures: rejected —
  SPEC assigns descriptor ownership to provider packages.
- Deleting `GtfsRealtimeDecoder.Passthrough`: rejected — documented escape
  hatch, used by tests.
- Deleting package-root barrels: rejected — the root export is the
  documented compatibility surface; barrels are slimmed instead (no aliases,
  no doubling).
- Renaming error `operation` strings or messages during dedupe: rejected —
  they are observable in CLI envelopes and pinned by tests.
- Compressing `packages/fixtures`: rejected per directive (leave alone).
- `bun run check` decomposition or gate weakening to make refactors easier:
  rejected — the gates are the safety story for every plan here.

### What the 2026-07-05 audit did NOT cover

Scope was semantic compression. Not audited: security posture beyond
incidental reads (no findings raised), performance, dependency currency
(one known routine bump: gtfs-realtime-bindings 2.0.0 → 2.1.0, folded into a
future release pass), `scripts/` + `.github/workflows/` beyond their coupling
to source layout, and the vendored `.repos/effect` checkout.

---

# Historical: 0.1.x build-out program (all DONE)

| Plan | Status | Priority | Effort | Dependencies |
| --- | --- | --- | --- | --- |
| [Contracts And SODA3 Feature Slice](contracts-soda3-feature-slice.md) | DONE | P0 | L | Verification baseline and Effect beta guardrails |
| [001: Tree-Shaking Export Surface](001-tree-shaking-export-surface.md) | DONE | P1 | M | Completed contracts/SODA3 feature slice and current verification baseline |
| [003: Optimal Package Structure](003-optimal-package-structure.md) | DONE | P1 | L | Tree-shaking export surface |
| [007: Effect Unstable CLI Migration](007-effect-unstable-cli-migration.md) | DONE | P1 | M | Completed verification baseline and current Effect 4 beta pin |
| [002: API Reference Docs](002-api-reference-docs.md) | DONE | P1 | M | Tree-shaking export surface; refresh after 003 and 007 if they land first |
| [004: Bun Build API For CLI Binary](004-bun-build-api-for-cli-binary.md) | DONE | P1 | S | None |
| [005: Stream CLI Download Writes](005-stream-cli-download-writes.md) | DONE | P1 | M | None |
| [006: Bun Native Package Archive Checks](006-bun-native-package-archive-checks.md) | DONE | P2 | M | None |
| [008: Type Public Request Inputs](008-type-public-request-inputs.md) | DONE | P1 | M | None |
| [009: Describe CLI Flags](009-describe-cli-flags.md) | DONE | P1 | S | None |
| [010: Document Socrata App Token](010-document-socrata-app-token.md) | DONE | P1 | S | None |
| [011: Use Real CLI GeneratedAt](011-use-real-cli-generated-at.md) | DONE | P1 | S | None |
| [012: Typecheck API Reference Examples](012-typecheck-api-reference-examples.md) | DONE | P1 | M | None |
| [013: Scale Provider Descriptors](013-scale-provider-descriptors.md) | DONE | P1 | L | Completed package-structure, API-reference, and docs-example check plans |
| [014: Real GTFS-RT Decoding](014-real-gtfs-rt-decoding.md) | DONE | P1 | M | Completed descriptor scaling plan |
| [015: Provider Coverage Model](015-provider-coverage-model.md) | DONE | P1 | L | Completed descriptor scaling plan; real GTFS-RT decoding recommended first |
| [016: Provider CLI Coverage](016-provider-cli-coverage.md) | DONE | P1 | L | Real GTFS-RT decoding and provider coverage model |
| [017: Use Bun Catalogs For Shared Third-Party Versions](017-use-bun-catalogs-for-third-party-versions.md) | DONE | P1 | M | Completed package archive checks and current Effect beta guardrails |
| [018: Consolidate SODA-Backed CLI Command Patterns](018-consolidate-cli-command-patterns.md) | DONE | P1 | M | None |
| [019: Share Provider Descriptor Tooling Primitives](019-share-provider-descriptor-tooling.md) | DONE | P1 | M | None |
| [020: Add Offline Coverage Checks For MTA Direct Feeds](020-add-mta-direct-feed-coverage-check.md) | DONE | P2 | M | Plan 019 recommended first |
| [021: Use Root Effect Imports In Tooling Scripts](021-use-root-effect-imports-in-tooling.md) | DONE | P1 | S | None |
| [022: Use Effect Unstable HTTP For Transit Clients](022-use-effect-unstable-http.md) | DONE | P1 | L | None |
| [023: Expand The SODA3 SoQL Helper Surface](023-expand-soql-helper-surface.md) | DONE | P1 | M | None |
| [024: Add SODA3 Date And Window Helpers](024-add-soda3-date-window-helpers.md) | DONE | P1 | M | Plan 023 |
| [025: Report CLI Download Metadata For Export And Fetch Commands](025-report-cli-download-metadata.md) | DONE | P1 | M | None |
| [026: Add A GTFS Realtime Raw Capture Surface](026-add-gtfs-realtime-raw-capture.md) | DONE | P1 | L | Plan 025 |
| [027: Enrich Provider Descriptor Metadata](027-enrich-provider-descriptor-metadata.md) | DONE | P2 | M | None |
| [028: Centralize V0 Release Version And Build Metadata](028-centralize-v0-release-version.md) | DONE | P1 | M | None |
| [029: Stage NPM-Ready Package Artifacts](029-stage-npm-package-artifacts.md) | DONE | P1 | L | Plan 028 |
| [030: Wire ts-release Release Orchestration](030-wire-ts-release-release-orchestration.md) | DONE | P1 | M | Plans 028 and 029 |
| [031: Add GitHub Release Readiness Workflows And Runbook](031-add-github-release-readiness.md) | DONE | P2 | M | Plans 028, 029, and 030 |
| [032: Add MTA JSON Direct Feed Clients](032-add-mta-json-direct-clients.md) | DONE | P1 | M | None |
| [033: Add Selected Typed Adapters](033-add-selected-typed-adapters.md) | DONE | P1 | M | Plan 032 for JSON direct adapter work |
| [034: Add A Repeatable Provider Coverage Release Ritual](034-repeatable-provider-coverage-release-ritual.md) | DONE | P2 | M | None |
| [035: Add Adoption Docs For The Published Toolkit](035-add-adoption-docs.md) | DONE | P2 | M | Refresh if plans 032 or 033 land first |
| [036: Add Public Native Layer Factories](036-add-public-native-layer-factories.md) | DONE | P1 | M | None |
| [037: Expand The Promise Compat Coverage Matrix](037-expand-promise-compat-coverage-matrix.md) | DONE | P1 | M | Plan 036 recommended first |
| [038: Document And Export The Promise Compat Error Contract](038-document-promise-compat-error-contract.md) | DONE | P2 | S | Plan 037 recommended first |
| [039: Accept A Minimal Structural Fetch Type](039-accept-minimal-fetch-type.md) | DONE | P1 | S | None |
| [040: Fix And Widen The Catalog Contract](040-fix-and-widen-catalog-contract.md) | DONE | P1 | M | None; land before 045 (shared fixture file) |
| [041: Adoption Docs And Package Metadata](041-adoption-docs-and-package-metadata.md) | DONE | P1 | M | Plan 039 |
| [042: Add Pagination And Count Helpers](042-add-pagination-and-count-helpers.md) | DONE | P1 | M | None |
| [043: Add Retry Backoff And MTA Policy](043-add-retry-backoff-and-mta-policy.md) | DONE | P2 | M | Plan 039 |
| [044: Add Discovery-Backed Dataset Metadata Helper](044-add-soda3-dataset-metadata-surface.md) | DONE | P2 | M | Plan 040 |
| [045: GTFS-RT Decode Ergonomics And Fixtures](045-gtfs-rt-decode-ergonomics-and-fixtures.md) | DONE | P2 | M | Plan 040 (shared fixture file) |
| [046: Harden Verification Gates](046-harden-verification-gates.md) | DONE | P2 | M | None |

The 0.1.x program's 49-step "Recommended Order" narrative is retired (every
plan is DONE; see the individual plan files and git history). Its
"Findings Considered And Rejected" list is preserved below because several
rejections remain binding (SODA2, downstream analytics, publishing policy);
two entries are reversed by the compression program above.

## Findings Considered And Rejected (0.1.x program — still binding unless reversed above)

- TypeDoc-only API docs: rejected for now because the current source-first v0
  API intentionally validates `unknown` inputs with `effect/Schema`; users need
  curated import paths, boundaries, and examples more than generated signatures.
- Per-package README files before npm publication: deferred because
  `docs/release.md` says no npm publication or binary distribution is approved
  for v0. Revisit before publishing packages.
- Bundle-size smoke testing: deferred because this repo does not otherwise use a
  bundler. The cheaper current guard is explicit subpath exports, internal
  subpath imports, and architecture tests.
- Replacing `process.env` with `Bun.env` in the CLI only for style: rejected
  because Bun documents `Bun.env` as an alias and `packages/cli` is already the
  only package allowed to read environment variables.
- Replacing every `node:fs` or `node:path` import with Bun APIs: rejected because
  Bun's file I/O docs still use Node-compatible filesystem APIs for directory
  operations, and the useful Bun-native wins here are build, write, pack, and
  archive APIs.
- Mirroring every NYC Open Data dataset as curated source constants before
  release: rejected for v0 unless product scope changes. Generic SODA3/catalog
  access should cover the full domain, while curated descriptors stay scoped to
  transit/provider-family surfaces.
- Using `catalog:` for internal `@nyc-transit-kit/*` dependencies in source
  manifests: rejected for plan 017. Keep literal release versions until a
  workspace release/versioning plan proves package archive behavior and
  publication semantics.
- Treating the MTA direct-feed descriptor constants as a bug by themselves:
  rejected. The useful follow-up is an offline coverage check and cleaner record
  ownership, not replacing small explicit descriptors with a live fetch.
- Adding SODA2 compatibility for familiar Socrata `/resource/` URLs: rejected
  because the repo's product boundary and architecture guards are explicitly
  SODA3-only.
- Porting downstream route analytics, detector runs, database projections, or
  hosted backfill workflows: rejected because `docs/product-boundary.md` keeps
  those app-specific concerns out of this public toolkit.
- Hashing every CLI download in plan 025: deferred because checksumming large
  response bodies needs a streaming design; the first CLI metadata plan should
  stay to status, output path, byte length, and content headers.
- Publishing raw `packages/*` directories directly with npm: rejected for v0
  release automation because source manifests intentionally use Bun catalog
  references, while npm/ts-release should validate staged publish directories
  with literal dependency specs.
- Committing `/mnt/models/dev/ts-release` as a `file:` dependency or hardcoded
  source path: rejected because local absolute paths must not enter package
  manifests or public release automation. Use `TS_RELEASE_CLI` locally or a
  checked-out/published `ts-release` tool in CI.
- Auto-publishing npm packages or GitHub releases on every tag push for the first
  v0: rejected until a manual dry-run and authenticated validation workflow have
  produced reviewable evidence.
- Replacing source-first package manifests with `dist` exports as part of the v0
  release: deferred. The current archive guards intentionally validate source
  exports; a JS-first npm migration should be a separate package-format plan.
- Replacing the current function-first SODA3 and provider operation exports with
  service-only method bags: rejected because the repo's public API rules favor
  narrow subpath exports and standalone operations, and external Effect-native
  libraries show both function-first and service-first APIs can work when layer
  construction is ergonomic.
- Adding Promise wrappers for every pure descriptor lookup or low-level decoder:
  rejected because `packages/compat` should cover Promise runtime boundaries,
  not duplicate synchronous helpers or native-only decoder utilities.
- ~~Consolidating provider CLI command handlers beyond plan 018~~ — REVERSED
  2026-07-05; see plan 055.
- Upstreaming the downstream `http-file-download` helper (progress events,
  instrumented retry): rejected; core packages stay runtime-agnostic, the CLI
  owns file I/O, and the consumer's version is app-instrumented by design.
- A fetch-level app-token injection helper: rejected; `Soda3ClientConfig.appToken`
  and compat `appToken` already exist. The consumer's wrapper serves non-kit
  endpoints, which shrink as plans 040/044 land.
- Treating stale `.release/npm` staging output (old effect pin) as a defect:
  rejected; the directory is gitignored and regenerated by
  `bun run release:prepare:npm`, and published 0.1.3 was verified at beta.92.
- Guarding `rangeHeader`'s `undefined` against header spreading: rejected;
  Effect's `Headers.fromInput` drops undefined values (verified in the vendored
  pinned source).
- Exporting a decoder interface for consumer mocks: rejected as already done;
  `GtfsRealtimeDecoderImplementation` is public from
  `@nyc-transit-kit/mta/gtfs-realtime` and re-exported by compat.
- gtfs-realtime-bindings 2.0.0 → 2.1.0: no plan; routine catalog bump to fold
  into the next release's dependency pass.
- Switching `effect` to a peerDependency: open maintainer decision, recorded
  (not decided) in plan 041's Compatibility section; revisit once the Effect 4
  line stabilizes.
- CLI provider-handler mocked-execution tests: gap CLOSED by plan 047 (was:
  below the 2026-07-04 plan cut).
