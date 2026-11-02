# @nyc-transit-kit/mta

Effect access to official MTA data: GTFS static zips, GTFS-realtime feeds,
elevator and escalator outages, Bus Time, and MTA datasets on NYS Open Data.

```sh
bun add effect@^4.0.6 @nyc-transit-kit/mta
```

```ts
import * as ElevatorEscalator from "@nyc-transit-kit/mta/ElevatorEscalator"
import * as GtfsRealtime from "@nyc-transit-kit/mta/GtfsRealtime"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"

export const program = Effect.gen(function* () {
  const lirr = yield* GtfsRealtime.fetchMessage(GtfsRealtime.feeds.lirr.url)
  const outages = yield* ElevatorEscalator.fetchRows(
    ElevatorEscalator.feeds["elevator-escalator-current"]
  )
  return { lirr: GtfsRealtime.summarize(lirr), outages: outages.length }
}).pipe(Effect.provide(FetchHttpClient.layer))
```

- Each module's `feeds` is a plain record indexed by name:
  `GtfsStatic.feeds`, `GtfsRealtime.feeds`, `ElevatorEscalator.feeds`,
  `BusTime.feeds`.
- The MTA answers a wrong feed path with HTTP 200 and an XML error, so
  `GtfsRealtime.fetchMessage` decodes before it succeeds.
- The "current" elevator feed includes upcoming outages; filter on
  `isupcomingoutage`.
- `GtfsRealtime.capture` saves raw bytes with a SHA-256 manifest and needs a
  `Crypto` layer, such as `BunCrypto.layer` from `@effect/platform-bun`.
- Modules: `/GtfsStatic`, `/GtfsRealtime`, `/ElevatorEscalator`, `/BusTime`,
  `/MtaOpenData`.

See the [API reference](https://github.com/mannyc2/nyc-transit-kit/blob/main/docs/api-reference.md).
