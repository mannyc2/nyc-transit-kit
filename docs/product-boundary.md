# Product Boundary

Repository name: `nyc-transit-kit`.

`nyc-transit-kit` is a standalone public toolkit for official NYC and MTA
transit data APIs. Package boundaries are based on official API/provider
families rather than any downstream application's private modules.

## Package Structure

- `packages/contracts`: shared public contracts implemented with `effect/Schema`.
- `packages/soda3`: generic Socrata SODA3 client helpers.
- `packages/mta`: official MTA GTFS, GTFS Realtime, and MTA Open Data surfaces.
- `packages/nyc-open-data`: NYC Open Data catalog and dataset helpers.
- `packages/nyc-dot`: NYC DOT dataset descriptors and thin adapters.
- `packages/cli`: curated public CLI built for Bun.
- `packages/compat`: optional Promise facade over Effect programs.
- `packages/fixtures`: tiny safe fixtures for tests and examples.

## API Model

The primary API is Effect-native. Core clients should return `Effect` values,
use typed errors, validate boundary data with `effect/Schema`, and receive
configuration explicitly.

Promise compatibility wrappers are optional facades over Effect programs. They
must not duplicate schemas, retry loops, endpoint construction, or provider
logic.

## SODA3-Only Rule

All Socrata-backed access is SODA3-only. The toolkit must not implement legacy
SODA2 helpers, fallback paths, compatibility aliases, or endpoint builders.

## Out Of Scope

Private downstream product logic is out of scope, including app-specific route
scoring, detector runs, database projections, route briefs, UI workflows, hosted
pipelines, and document extraction.
