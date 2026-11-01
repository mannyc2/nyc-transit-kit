# Product Boundary

`nyc-transit-kit` is a standalone public toolkit for official NYC and MTA
transit data. Package boundaries follow the official providers, not any
downstream application's modules.

## Apps And Packages

`apps/` holds what deploys; `packages/` holds the libraries, one per official
provider.

- `packages/soda3`: Socrata on any domain: SODA3 query and export, the
  Discovery API, and SoQL.
- `packages/mta`: MTA GTFS, GTFS-realtime, elevator and escalator, Bus Time,
  and MTA datasets on NYS Open Data.
- `packages/nyc-open-data`: the NYC Open Data domain and its curated datasets,
  NYC DOT's included (`NycDot`).
- `packages/fixtures`: real response samples and the HTTP test layer.
- `apps/cli`: the `ntk` CLI, for Bun.

A schema lives in the module of the provider that defines it. `mta` and
`nyc-open-data` depend on `soda3`, the CLI on all three, and nothing depends on
the CLI; `tests/architecture` enforces that.

## API Model

The API is Effect-native. Functions return `Effect` or `Stream` values, fail
with typed errors, decode provider data with `effect/Schema`, and take
configuration as arguments or layers. There is no Promise facade: a caller who
wants Promises runs the program at their own edge with `Effect.runPromise` or a
`ManagedRuntime`.

## SODA3 Only

All Socrata access is SODA3. The toolkit has no SODA2 helpers, `/resource/`
URLs, fallback paths or compatibility aliases.

## Out Of Scope

Downstream product logic stays downstream: route scoring, detector runs,
database projections, route briefs, UI workflows, hosted pipelines and document
extraction.
