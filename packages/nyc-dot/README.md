# @nyc-transit-kit/nyc-dot

Curated NYC DOT dataset descriptors and SODA3-backed query/export helpers.

Use this package for provider-owned NYC DOT defaults such as traffic speeds,
traffic volume, and bus lanes. The package delegates Socrata-backed access to
`@nyc-transit-kit/soda3` and does not contain legacy Socrata compatibility
helpers.

## Import Paths

```ts
import { queryNycDotDataset } from "@nyc-transit-kit/nyc-dot/datasets"
import { findNycDotDataset } from "@nyc-transit-kit/nyc-dot/datasets"
```

Prefer subpaths for tree-shaking and stable package boundaries.

## Compatibility

Each release pins one exact Effect 4 beta. Match the Effect version documented
in `docs/getting-started.md`.
