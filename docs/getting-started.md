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
bun add effect @nyc-transit-kit/soda3
bun add @nyc-transit-kit/mta @nyc-transit-kit/nyc-dot
bun add @nyc-transit-kit/compat
```

Install only the provider packages your app needs. For CLI use, install
`@nyc-transit-kit/cli` or run the repo binary during development.

## Effect-Native Query

Socrata-backed access is SODA3-only. Core packages take explicit config through
arguments, services, and layers.

```ts
import { Soda3ClientConfig } from "@nyc-transit-kit/soda3/client"
import { queryRows } from "@nyc-transit-kit/soda3/query"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"

const program = queryRows({
  domain: "data.cityofnewyork.us",
  datasetId: "ycrg-ses3",
  query: "SELECT * LIMIT 5"
}).pipe(
  Effect.provide(
    Layer.mergeAll(
      Layer.succeed(Soda3ClientConfig)({
        retryTimes: 2
      }),
      FetchHttpClient.layer
    )
  )
)
```

## Provider Helper

Provider packages add domain defaults, curated descriptors, and selected typed
adapters on top of the generic SODA3 layer.

```ts
import { queryNycDotDataset } from "@nyc-transit-kit/nyc-dot/client"
import { Soda3ClientConfig, Soda3HttpLive } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const program = queryNycDotDataset({
  name: "traffic-speeds",
  query: "SELECT * LIMIT 5"
}).pipe(Effect.provide(Layer.mergeAll(Soda3ClientConfig.Default, Soda3HttpLive)))
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

Every CLI command supports `--json`, and dry-run commands avoid live provider
calls.

```sh
ntk --version --json
ntk socrata query --domain data.cityofnewyork.us --dataset ycrg-ses3 --select "*" --json --dry-run
ntk mta gtfs-rt probe --feed alerts-all --json --dry-run
```

## Tokens

`SOCRATA_APP_TOKEN` is optional and CLI-only. Core packages do not read
environment variables; pass app tokens through explicit config such as
`Soda3ClientConfig` or Promise compat options.

```sh
SOCRATA_APP_TOKEN=<token> ntk socrata query --domain data.cityofnewyork.us --dataset ycrg-ses3 --select "*" --json
```

## Boundaries

Generic access is broad, typed adapters are curated, and downstream product
logic stays downstream. Start with the provider coverage docs when you need to
understand release scope. See [Product Boundary](product-boundary.md),
[Provider Coverage](provider-coverage.md), [Downstream Adapters](downstream-adapters.md),
and the [API Reference](api-reference.md).
