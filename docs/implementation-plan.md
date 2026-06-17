# Implementation Plan

This plan turns `SPEC.md` into a test-driven Bun monorepo without widening the
product boundary.

## Stage 0: Foundation

- Keep the root package private and use Bun workspaces for `packages/*`.
- Centralize shared third-party versions in Bun workspace catalogs.
- Allow `catalog:` in publishable source manifests only for approved third-party
  dependencies listed in the root catalog.
- Keep package archives publishable by proving packed manifests resolve catalog
  references to normal version strings and contain no `workspace:`, `catalog:`,
  `file:`, local path specs, or private absolute paths.
- Configure `bunfig.toml` for `bun test` and ignore vendored/source checkout
  directories during discovery.
- Add one-command verification with `bun run check`.
- Add the Effect skill prerequisite using the local-clone `.repos/effect`
  prepare script.

## Stage 1: Docs And Guards

- Maintain `docs/product-boundary.md` and `docs/official-api-map.md` before
  broad client work.
- Keep SODA3-only checks in architecture tests.
- Keep package archive preflight checks in `tests/package-archives`.
- Add package tests before or alongside implementation.

## Stage 2: Contracts First

- Implement `packages/contracts` with `effect/Schema` for identifiers, provider
  DTOs, CLI envelopes, and release manifests.
- Tests should decode valid and invalid examples through schemas.
- No HTTP, filesystem, credentials, CLI parsing, or provider SDK logic belongs
  in this package.

## Stage 3: SODA3 Client

- Implement endpoint construction, catalog helpers, query/export helpers, app
  token wiring, retries, timeouts, and typed provider errors.
- Use injected fetch/config services for deterministic tests.
- Source scans must keep legacy Socrata endpoint support out of package code.

## Stage 4: Provider Families

- `packages/mta` owns MTA GTFS, GTFS Realtime, and MTA Open Data descriptors.
- `packages/nyc-open-data` owns NYC Open Data domain defaults and descriptors.
- `packages/nyc-dot` owns DOT dataset descriptors and thin adapters.
- Socrata-backed provider packages must delegate access through `packages/soda3`.

## Stage 5: CLI And Compat

- `packages/cli` owns the public Bun CLI and may read environment variables.
- Core packages must receive explicit config and never read `process.env`.
- Every CLI command must support `--json`.
- `packages/compat` may expose Promise wrappers, but only by running underlying
  Effect programs.

## Stage 6: Release

- Add binary build output, release manifest generation, and package archive
  checks before any publish.
- Do not publish packages or binaries until `bun run check`, archive preflight,
  and binary version JSON all pass.

## Version Decision

The repository uses the Effect beta line from the start:

- `effect@4.0.0-beta.83`
- `@effect/platform-bun@4.0.0-beta.83`

As of 2026-06-16, `@effect/cli@latest` is `0.75.2` and peers the Effect 3 line,
while `effect` and `@effect/platform-bun` expose `4.0.0-beta.83` on their beta
dist-tags. The repository therefore keeps `@effect/cli` out of the workspace for
now.

CLI work should follow this rule:

- build command parsing with the pinned Effect 4 beta's built-in unstable CLI
  modules from `effect/unstable/cli/*`.
- expose all machine-readable output through Effect-schema-backed contracts.
- keep focused parser tests around help, version output, required options, and
  JSON error envelopes because `effect/unstable/cli` is not a stable API yet.
- add `@effect/cli` only after verifying a release that peers the Effect 4 beta
  line.
- rely on architecture tests to reject any Effect runtime package that is not
  pinned to `4.0.0-beta.83`.
- keep `@effect/language-service` as root-only developer tooling. It is versioned
  independently from the runtime packages and is patched into workspace
  TypeScript by the root prepare script.
