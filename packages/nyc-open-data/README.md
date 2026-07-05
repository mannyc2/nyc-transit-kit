# @nyc-transit-kit/nyc-open-data

NYC Open Data descriptors plus SODA3-backed query, export, and catalog helpers.

This package provides NYC Open Data defaults on top of the generic Socrata
SODA3 client. Discovery/catalog access uses Socrata Discovery APIs; data access
uses SODA3 query/export endpoints only.

## Import Paths

```ts
import { queryNycOpenDataDataset } from "@nyc-transit-kit/nyc-open-data/client"
import { searchNycOpenDataCatalog } from "@nyc-transit-kit/nyc-open-data/catalog"
```

Prefer subpaths for provider helpers and descriptor lookup.

## Compatibility

Each release pins one exact Effect 4 beta. Match the Effect version documented
in `docs/getting-started.md`.
