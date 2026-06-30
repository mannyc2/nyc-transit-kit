# Downstream Adapters

Downstream applications should consume this toolkit without moving their private
product logic into this repository.

For the current package export map, preferred subpath imports, and symbol
reference, see the [API reference](api-reference.md). For a task-oriented
adoption path, see [Getting Started](getting-started.md).

## Effect-Native Consumption

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

Provider packages expose Effect programs and receive configuration through
services or arguments. For Socrata-backed datasets, MTA Open Data, NYC Open
Data, and NYC DOT helpers delegate to `@nyc-transit-kit/soda3`.
Use Effect-native APIs when callers already use Effect or want typed errors,
layers, retries, and composition at the application edge.
Prefer operation subpaths such as `@nyc-transit-kit/soda3/query` for application
and package code. Use `@nyc-transit-kit/soda3/client` for SODA3 services and
layers. Package-root imports remain a convenience surface for broad exploration,
but subpaths give bundlers the clearest tree-shaking boundary.

## Promise Compat Consumption

```ts
import { queryNycDotRows } from "@nyc-transit-kit/compat/nyc-dot"

const rows = await queryNycDotRows({
  name: "traffic-speeds",
  query: "SELECT *"
})
```

`packages/compat` contains thin Promise wrappers over Effect programs. Those
wrappers must not duplicate endpoint construction, retry behavior, schema
definitions, or provider-specific business logic.
Use `@nyc-transit-kit/compat/*` wrappers when callers want Promises and do not
need to own an Effect runtime directly. Promise wrappers reject with the native
typed errors from the underlying Effect programs; use
`@nyc-transit-kit/compat/errors` for shared error imports,
`isTransitKitCompatError`, and provider-family guards such as
`isSoda3ClientError`.

## Keep Local To Downstreams

Downstream projects should keep analytics, database projections, detector logic,
route scoring, route briefs, product-specific UI, hosted pipelines, and document
extraction in their own repositories.
