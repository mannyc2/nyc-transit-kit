# Agent Guide

`nyc-transit-kit` is an Effect-native Bun monorepo for official NYC and MTA
transit data. The standing decisions are in `SPEC.md`; read it first.

## Layout

- `apps/cli` is the `ntk` binary, the one thing that deploys.
- `packages/` are libraries, one per provider: `soda3` (Socrata on any domain),
  `mta`, `nyc-open-data` (NYC DOT included) and `fixtures` (real samples and
  the HTTP test layer).
- A module is a PascalCase file (`Soda3Client.ts`), imported as a namespace.
  Its test is `test/<Module>.test.ts`.

## Rules

- Effect is 4.0.6 stable. The installed `node_modules/effect` is the API
  authority: read `node_modules/effect/AGENTS.md` and the declarations before
  using an API. There is no vendored Effect checkout.
- Libraries peer `effect` at `^4.0.6`. The CLI pins `effect`,
  `@effect/platform-bun` and `@effect/platform-node-shared` through the root
  catalog. `platform-bun` only ranges `platform-node-shared`, so without the
  pin a fresh install takes one built for a newer Effect; 0.3.0 shipped that way.
  `bun run check:npm-stage` installs the CLI fresh to catch it.
- Use Bun for installs, scripts, tests and builds.
- Socrata access is SODA3 only: no SODA2 helpers, `/resource/` URLs, fallbacks
  or aliases. Build SoQL with `Soql` fragments; values become SoQL literals.
- Libraries take values. No `process.env`, `Config` or `ConfigProvider` outside
  `apps/cli`, and no retries or timeouts inside a library.
- Each workspace depends only on the packages below it; see
  `allowedInternalDependencies` in `tests/architecture/helpers.ts`.
- Every module of a package is a subpath export. Import sibling packages by
  subpath and Effect by module (`effect/Effect`, never `effect`).
- Test samples are real responses in `packages/fixtures`; never hand-write one.
  Fakes refuse what the provider refuses. Test HTTP with `HttpTest.layer` and
  time with `TestClock`. Mutation-check each fix.
- Record what a live request taught you about a provider in
  `docs/official-api-map.md`, with the date.
- Downstream product logic stays out; see `docs/product-boundary.md`.
- Packed manifests contain no `workspace:`, `catalog:`, `file:` or local paths.
  Internal dependencies are literal release versions.
- `@effect/language-service` is root-only tooling; `bun install` patches it into
  TypeScript.
- `tools/release` is a standalone package with its own lockfile, so the release
  runner can stay on the Effect beta that `ts-release` 0.0.7 needs. Keep it out
  of the workspace until `ts-release` is upgraded.

## Verify Before Handing Off

```sh
bun install
bun run check
bun run build:cli
./dist/ntk --version --json
```

Use `bun --bun vitest run <path>` for focused loops. Release staging
(`bun run release:prepare:npm`, `bun run check:npm-stage`) may contact npm; run
it for releases, not in the inner loop.
