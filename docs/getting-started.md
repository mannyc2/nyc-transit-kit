# Getting Started

`nyc-transit-kit` is for transit-data developers, analysts, and downstream
applications that need typed access to official NYC and MTA public data without
bringing product-specific analytics into this repository.

## Who This Is For

- Transit-data developers building against official NYC/MTA APIs.
- Analysts using the Bun CLI to inspect, query, export, or dry-run public data.
- Downstream apps that want Effect-native clients or thin Promise wrappers.

## Install

The v0 packages are source-first TypeScript packages. They are best consumed
from Bun or from a TypeScript toolchain that can compile TypeScript in
dependencies.

```sh
bun add effect@4.0.0-beta.92 @nyc-transit-kit/soda3@0.2.0
bun add @nyc-transit-kit/mta @nyc-transit-kit/nyc-dot
bun add @nyc-transit-kit/compat
```

Install only the provider packages your app needs. For CLI use, install
`@nyc-transit-kit/cli` or run the repo binary during development.

## Compatibility

Each `nyc-transit-kit` release pins one exact Effect 4 beta. Pin your
application's `effect` package to the same version or the lockfile can install
two Effect copies with incompatible types.

| nyc-transit-kit | effect | @effect/platform-bun |
| --- | --- | --- |
| 0.1.0 / 0.1.1 | 4.0.0-beta.83 | 4.0.0-beta.83 |
| 0.1.2 / 0.1.3 / 0.1.4 | 4.0.0-beta.92 | 4.0.0-beta.92 |
| 0.2.0 | 4.0.0-beta.92 | 4.0.0-beta.92 |

```sh
bun add effect@4.0.0-beta.92 @nyc-transit-kit/soda3@0.2.0
```

The tested downstream TypeScript envelope is TS 6.x with `strict`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
`noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`,
`module: Preserve`, `moduleResolution: Bundler`, and
`allowImportingTsExtensions`; see
[`tests/downstream-strict/tsconfig.json`](../tests/downstream-strict/tsconfig.json).

`effect` is currently an exact regular dependency, not a peer dependency. A
version mismatch surfaces as a duplicate install rather than an install-time
conflict.

## Migrating 0.1.x To 0.2.0

0.2.0 is the first surface-compression release. It keeps package boundaries and
runtime behavior intact, but removes compatibility aliases and folds several
small subpaths into their owning concepts.

Use these import moves when updating 0.1.x callers:

| 0.1.x import or name | 0.2.0 replacement |
| --- | --- |
| `@nyc-transit-kit/contracts/descriptor-registry` | `@nyc-transit-kit/contracts/descriptors` |
| `@nyc-transit-kit/contracts/nyc-dot` | `@nyc-transit-kit/contracts/descriptors` |
| `@nyc-transit-kit/contracts/nyc-open-data` | `@nyc-transit-kit/contracts/descriptors` |
| root `*Type` schema aliases from `@nyc-transit-kit/contracts` | import the original schema-inferred type names directly |
| `Soda3Operation` | removed; branch on the request shape or command context instead |
| `CliEnvelopeStatus` | removed; use `CliEnvelope` and its `ok` discriminant |
| `@nyc-transit-kit/mta/datasets` | `@nyc-transit-kit/mta/open-data` or `@nyc-transit-kit/mta/feeds` |
| `@nyc-transit-kit/mta/elevator-escalator` | `@nyc-transit-kit/mta/json-direct` |
| `@nyc-transit-kit/mta/open-data-catalog` | `@nyc-transit-kit/mta/open-data` |
| `gtfsStaticSurface`, `gtfsRealtimeSurface` | removed from the MTA root surface; use feed descriptors from `@nyc-transit-kit/mta/feeds` |
| `@nyc-transit-kit/nyc-open-data/query` | `@nyc-transit-kit/nyc-open-data/client` |
| `@nyc-transit-kit/nyc-open-data/catalog` | `@nyc-transit-kit/nyc-open-data/client` |
| `@nyc-transit-kit/nyc-open-data/datasets` | `@nyc-transit-kit/nyc-open-data/descriptors` |
| deprecated NYC Open Data DOT descriptor aliases | use DOT descriptors from `@nyc-transit-kit/nyc-dot/datasets` |
| `@nyc-transit-kit/nyc-dot/client` | `@nyc-transit-kit/nyc-dot/datasets` |
| `@nyc-transit-kit/nyc-dot/errors` | `@nyc-transit-kit/nyc-dot/datasets` |
| `@nyc-transit-kit/nyc-dot/bus-lanes` | `@nyc-transit-kit/nyc-dot/rows` |
| `@nyc-transit-kit/nyc-dot/traffic-speeds` | `@nyc-transit-kit/nyc-dot/rows` |
| `@nyc-transit-kit/nyc-dot/traffic-volume` | `@nyc-transit-kit/nyc-dot/rows` |
| compat error imports from `@nyc-transit-kit/compat/soda3`, `/mta`, `/nyc-open-data`, or `/nyc-dot` | `@nyc-transit-kit/compat/errors` or the compat package root |
| CLI source `*CommandPaths` arrays | removed; use the command tree itself rather than source-level path arrays |

The new `@nyc-transit-kit/soda3/transport` subpath exposes the shared low-level
transport policy helpers used by SODA3 and MTA provider packages.

## Effect-Native Query

Socrata-backed access is SODA3-only. Core packages take explicit config through
arguments, services, and layers.

```ts
import { soda3Layer } from "@nyc-transit-kit/soda3/client"
import { queryRows } from "@nyc-transit-kit/soda3/query"
import * as Effect from "effect/Effect"

const program = queryRows({
  domain: "data.cityofnewyork.us",
  datasetId: "ycrg-ses3",
  query: "SELECT * LIMIT 5"
}).pipe(Effect.provide(soda3Layer({ retryTimes: 2 })))
```

## Provider Helper

Provider packages add domain defaults, curated descriptors, and selected typed
adapters on top of the generic SODA3 layer.

```ts
import { queryNycDotDataset } from "@nyc-transit-kit/nyc-dot/datasets"
import { soda3Layer } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"

const program = queryNycDotDataset({
  name: "traffic-speeds",
  query: "SELECT * LIMIT 5"
}).pipe(Effect.provide(soda3Layer()))
```

MTA direct-feed descriptors are available without contacting live endpoints:

```ts
import { findMtaJsonDirectFeed } from "@nyc-transit-kit/mta/feeds"

const feed = findMtaJsonDirectFeed("elevator-escalator-current")
```

## Promise Compat

Use `@nyc-transit-kit/compat/*` wrappers when the caller wants Promises instead
of owning an Effect runtime.

```ts
import { queryNycDotRows } from "@nyc-transit-kit/compat/nyc-dot"

const rowsPromise = queryNycDotRows({
  name: "traffic-speeds",
  query: "SELECT * LIMIT 5"
})
```

Promise wrappers reject with the same typed errors as the underlying Effect
programs. Import error classes, provider-family guards, and
`isTransitKitCompatError` from `@nyc-transit-kit/compat/errors` when Promise
callers need to narrow failures.

## CLI

The published CLI requires Bun at runtime because its npm bin is a Bun-shebang
wrapper. Install it with Bun and run it through `bunx`. Every command supports
`--help`; `--json` is the stable machine-readable contract, and dry-run commands
avoid live provider calls.

```sh
bun add -d @nyc-transit-kit/cli
bunx ntk --version --json
bunx ntk socrata query --domain data.cityofnewyork.us --dataset ycrg-ses3 --select "*" --json --dry-run
bunx ntk mta gtfs-rt probe --feed alerts-all --json --dry-run
```

## Tokens

`SOCRATA_APP_TOKEN` is optional and CLI-only. Core packages do not read
environment variables; pass app tokens through explicit config such as
`Soda3ClientConfig` or Promise compat options.

```sh
SOCRATA_APP_TOKEN=<token> bunx ntk socrata query --domain data.cityofnewyork.us --dataset ycrg-ses3 --select "*" --json
```

## Boundaries

Generic access is broad, typed adapters are curated, and downstream product
logic stays downstream. Start with the provider coverage docs when you need to
understand release scope. See [Product Boundary](product-boundary.md),
[Provider Coverage](provider-coverage.md), [Downstream Adapters](downstream-adapters.md),
and the [API Reference](api-reference.md).
