# @nyc-transit-kit/mta

Effect-native helpers for official MTA data surfaces.

The package covers GTFS static feeds, GTFS realtime probes and decoding, direct
MTA JSON feeds, and MTA Open Data helpers. MTA Open Data delegates through the
generic SODA3 client.

## Import Paths

```ts
import { findMtaGtfsRealtimeFeed } from "@nyc-transit-kit/mta/feeds"
import { probeGtfsRealtime } from "@nyc-transit-kit/mta/gtfs-realtime"
```

Prefer subpaths such as `@nyc-transit-kit/mta/gtfs-realtime`,
`@nyc-transit-kit/mta/gtfs-static`, and `@nyc-transit-kit/mta/json-direct`.

## Compatibility

Each `nyc-transit-kit` release pins one exact Effect 4 beta. Match the Effect
version documented in `docs/getting-started.md`.
