# nyc-transit-kit

Effect-native TypeScript toolkit for official NYC and MTA transit data APIs.
It provides source-first TypeScript packages, a Bun CLI, and Promise compat
wrappers for consumers that do not want to own an Effect runtime directly.

## Packages

The repository is organized by official API/provider family:

- `@nyc-transit-kit/contracts`
- `@nyc-transit-kit/soda3`
- `@nyc-transit-kit/mta`
- `@nyc-transit-kit/nyc-open-data`
- `@nyc-transit-kit/nyc-dot`
- `@nyc-transit-kit/cli`
- `@nyc-transit-kit/compat`
- `@nyc-transit-kit/fixtures`

Start with [Getting started](docs/getting-started.md), then use the
[API reference](docs/api-reference.md) for the full export map. The v0 packages
publish TypeScript source and are best consumed from Bun or a TypeScript
toolchain that can compile dependencies.

```sh
bun add effect @nyc-transit-kit/soda3
bun add @nyc-transit-kit/mta @nyc-transit-kit/nyc-dot @nyc-transit-kit/compat
```

## CLI

Every command supports `--json`; dry-run commands avoid live provider calls.

```sh
ntk --version --json
ntk socrata query --domain data.cityofnewyork.us --dataset ycrg-ses3 --select "*" --json --dry-run
ntk mta gtfs-rt probe --feed alerts-all --json --dry-run
```

Socrata-backed datasets are SODA3-only. Do not add SODA2 endpoint builders,
compatibility aliases, or manifest fields.

Coverage model: generic SODA3 commands provide broad access to supported
Socrata domains, provider commands add curated descriptors and defaults, and
typed adapters are intentionally narrower. See
[Provider coverage](docs/provider-coverage.md) for the release scope.

## Effect And Promise Imports

Prefer package subpaths for application and package code:

```ts
import { Soda3ClientConfig } from "@nyc-transit-kit/soda3/client"
import { queryRows } from "@nyc-transit-kit/soda3/query"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"

const program = queryRows({
  domain: "data.cityofnewyork.us",
  datasetId: "ycrg-ses3",
  query: "SELECT *"
}).pipe(
  Effect.provide(
    Layer.mergeAll(
      Layer.succeed(Soda3ClientConfig)({ retryTimes: 2 }),
      FetchHttpClient.layer
    )
  )
)
```

```ts
import { queryNycDotRows } from "@nyc-transit-kit/compat/nyc-dot"

const rowsPromise = queryNycDotRows({
  name: "traffic-speeds",
  query: "SELECT *"
})
```

## CLI Configuration

`SOCRATA_APP_TOKEN` is optional and is used only by CLI Socrata-backed
requests. Core packages still receive explicit config through arguments,
services, and layers; they do not read environment variables.

```sh
SOCRATA_APP_TOKEN=<token> bun run cli socrata query --domain data.cityofnewyork.us --dataset ycrg-ses3 --select "*" --json
```

## Development

The default development loop is Bun-first:

```sh
bun install
bun test
bun run check
```

Common repo CLI surfaces:

```sh
bun run cli nyc-open-data dataset query --dataset ycrg-ses3 --select "*" --json --dry-run
bun run cli nyc-dot dataset query --name traffic-speeds --select "*" --json --dry-run
bun run cli mta gtfs-rt decode --feed alerts-all --json --dry-run
```

See:

- [Getting started](docs/getting-started.md)
- [API reference](docs/api-reference.md)
- [Provider coverage](docs/provider-coverage.md)
- [Product boundary](docs/product-boundary.md)
- [Official API map](docs/official-api-map.md)
- [Implementation plan](docs/implementation-plan.md)
- [Testing strategy](docs/testing.md)
