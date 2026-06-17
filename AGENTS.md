# Agent Guide

This repository is `nyc-transit-kit`, an Effect-native Bun monorepo for official
NYC and MTA transit data APIs.

## Core Rules

- Keep all Effect packages on the Effect 4 beta line. Current pinned versions:
  `effect@4.0.0-beta.83` and `@effect/platform-bun@4.0.0-beta.83`.
- Do not install `@effect/cli@0.75.2`; it peers the Effect 3 line. Add
  `@effect/cli` only when a release compatible with Effect 4 beta is available.
- Use Bun for package management, scripts, tests, and binary builds.
- Keep package boundaries organized by official API/provider family.
- Keep Socrata-backed access SODA3-only. Do not add SODA2 helpers, `/resource/`
  endpoint builders, fallback paths, or compatibility aliases.
- Core packages must receive explicit config and must not read `process.env`.
- `packages/cli` is the only package allowed to read CLI environment variables.
- Publishable source manifests may use `catalog:` only for approved third-party
  dependencies listed in the root Bun catalog. Packed and published manifests
  must not contain `workspace:`, `catalog:`, `file:`, local path specs, or
  private absolute paths. Internal `@nyc-transit-kit/*` dependencies must remain
  literal release versions unless a separate release/versioning plan changes
  that rule.
- Optimize package APIs for tree shaking. Prefer narrow subpath exports and
  internal subpath imports over package-root barrels. Keep public APIs as
  standalone functions or typed services, avoid method-bag namespace exports,
  and use deep Effect module imports when they are available in the pinned
  Effect 4 beta release.
- Keep `@effect/language-service` as root-only developer tooling. It is versioned
  separately from Effect runtime packages, is wired through `tsconfig.base.json`,
  and is patched into workspace TypeScript by the root prepare script.

## Verification

Run these before handing off implementation work:

```sh
bun install
bun run check
bun run build:cli
./dist/ntk --version --json
```

Use `bun test <path>` for focused TDD loops.

## Implementation Order

Follow the planned shape in `SPEC.md` and `docs/implementation-plan.md`:

1. Contracts with `effect/Schema`.
2. Generic SODA3 client.
3. Provider packages that delegate Socrata-backed access through SODA3.
4. CLI and Promise compat wrappers.

Do not move downstream product analytics, route scoring, detector logic, route
briefs, hosted pipelines, or app-specific UI into this repository.
