# nyc-transit-kit

Typed access to official NYC and MTA transit data, built on Effect 4. It has a
SODA3 client for any Socrata domain, MTA GTFS and elevator feeds, curated NYC
DOT datasets with row schemas checked against real responses, and a Bun CLI
whose `--json` output is a stable contract.

## Layout

`apps/` holds what deploys, `packages/` the libraries. Each package follows one
official provider, and each module is a namespace:
`import * as Soql from "@nyc-transit-kit/soda3/Soql"`.

| Package | Modules | Holds |
| --- | --- | --- |
| `@nyc-transit-kit/soda3` | `Soda3Client`, `Dataset`, `Discovery`, `Soql`, `Socrata` | SODA3 query and export on any Socrata domain, Discovery search, SoQL built on `effect/sql` Statement |
| `@nyc-transit-kit/mta` | `GtfsStatic`, `GtfsRealtime`, `ElevatorEscalator`, `BusTime`, `MtaOpenData` | GTFS static and realtime feeds, elevator and escalator outages, Bus Time, MTA datasets on NYS Open Data |
| `@nyc-transit-kit/nyc-open-data` | `NycDot`, `NycOpenData` | NYC DOT traffic speeds, traffic volume counts and bus lanes with row schemas, and the NYC Open Data domain |
| `@nyc-transit-kit/fixtures` | `Samples`, `HttpTest` | Real response samples, and an `HttpClient` for tests that records each request |
| `@nyc-transit-kit/cli` (app) | `Cli`, `Envelope`, `ReleaseManifest` | The `ntk` binary and the schema of its JSON output |

The packages publish TypeScript source; use Bun or a toolchain that compiles
dependencies. `effect` is a peer dependency:

```sh
bun add effect@^4.0.6 @nyc-transit-kit/soda3 @nyc-transit-kit/nyc-open-data
```

```ts
import * as NycDot from "@nyc-transit-kit/nyc-open-data/NycDot"
import * as Dataset from "@nyc-transit-kit/soda3/Dataset"
import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as Soql from "@nyc-transit-kit/soda3/Soql"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"

const speeds = Dataset.query(NycDot.datasets["traffic-speeds"], {
  where: Soql.eq("borough", "Queens"),
  limit: 10
})

// Your app reads the token; the library takes it as a value.
const Soda3Live = Layer.unwrap(
  Effect.map(Config.Redacted("SOCRATA_APP_TOKEN"), (appToken) => Soda3Client.layer({ appToken }))
).pipe(Layer.provide(FetchHttpClient.layer))

// Sent as SELECT * WHERE `borough` = 'Queens' LIMIT 10; rows arrive decoded.
const rows = await Effect.runPromise(speeds.pipe(Effect.provide(Soda3Live)))
```

SODA3 refuses query and export without a Socrata
[app token](https://dev.socrata.com/docs/app-tokens). The libraries never read
the environment: pass the token in. Start with
[Getting started](docs/getting-started.md).

## CLI

The CLI needs Bun at runtime.

```sh
bun add -d @nyc-transit-kit/cli
export SOCRATA_APP_TOKEN=...

bunx ntk nyc-dot dataset query --name traffic-speeds --select "link_name, speed LIMIT 5"
bunx ntk catalog search --domain data.ny.gov --query subway --limit 5
bunx ntk mta gtfs-rt probe --feed subway-ace --json
bunx ntk mta gtfs-rt capture --feed lirr --output lirr.pb --manifest-output lirr.json
bunx ntk socrata export --domain data.ny.gov --dataset f462-ka72 --format csv --output mta.csv --dry-run
```

- `--json` writes exactly one envelope, `{ ok, data | error, meta }`, to stdout.
  Readable output is not a contract.
- `--dry-run` prints the requests a command would send, with the token
  redacted. It sends nothing and writes nothing.
- `SOCRATA_APP_TOKEN` is read only by the CLI, as the default for `--app-token`.
- Files are written beside their destination and renamed, so a failed download
  leaves nothing behind.

Socrata access is SODA3 only. Generic commands reach any dataset on any Socrata
domain; curated datasets add names and row schemas. See
[Provider coverage](docs/provider-coverage.md) for what is curated and why.

## Development

```sh
bun install
bun run check        # types, published-source types, Effect diagnostics, Biome, tests, package archives
bun run test         # @effect/vitest, in Bun
bun run build:cli    # dist/ntk
./dist/ntk --version --json
```

## Docs

- [Getting started](docs/getting-started.md): install, examples, migrating to 0.3.0
- [API reference](docs/api-reference.md): every export path and CLI command
- [Provider coverage](docs/provider-coverage.md): what is curated and how coverage is checked
- [Official API map](docs/official-api-map.md): verified provider facts
- [Testing](docs/testing.md): `@effect/vitest`, `HttpTest` and `TestClock`
- [Product boundary](docs/product-boundary.md) and
  [downstream adapters](docs/downstream-adapters.md)
- [Release](docs/release.md)
- [SPEC](SPEC.md): the standing design decisions
