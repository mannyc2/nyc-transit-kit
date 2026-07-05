# @nyc-transit-kit/soda3

Generic Effect-native client for Socrata SODA3 query, export, and Discovery
catalog APIs.

Socrata-backed data access is SODA3-only. This package does not expose legacy
Socrata endpoint helpers, fallback endpoint builders, or compatibility aliases.

## Import Paths

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

Prefer subpaths such as `@nyc-transit-kit/soda3/query`,
`@nyc-transit-kit/soda3/export`, `@nyc-transit-kit/soda3/catalog`, and
`@nyc-transit-kit/soda3/client`.

## Compatibility

Each `nyc-transit-kit` release pins one exact Effect 4 beta. Match the Effect
version documented in `docs/getting-started.md`.
