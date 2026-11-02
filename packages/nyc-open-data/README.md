# @nyc-transit-kit/nyc-open-data

NYC Open Data, `data.cityofnewyork.us`, and its curated datasets: NYC DOT's
traffic speeds, traffic volume counts and bus lanes, each with the schema of
its rows. Any other dataset works by id through `@nyc-transit-kit/soda3`.

```sh
bun add effect@^4.0.6 @nyc-transit-kit/soda3 @nyc-transit-kit/nyc-open-data
```

```ts
import * as NycDot from "@nyc-transit-kit/nyc-open-data/NycDot"
import * as NycOpenData from "@nyc-transit-kit/nyc-open-data/NycOpenData"
import * as Dataset from "@nyc-transit-kit/soda3/Dataset"
import * as Discovery from "@nyc-transit-kit/soda3/Discovery"
import * as Soql from "@nyc-transit-kit/soda3/Soql"

// Typed rows; needs a Soda3Client layer.
export const queensSpeeds = Dataset.query(NycDot.datasets["traffic-speeds"], {
  where: Soql.eq("borough", "Queens"),
  limit: 10
})

// Needs only an HttpClient layer; Discovery takes no token.
export const search = Discovery.search({ domain: NycOpenData.domain, query: "subway", limit: 10 })
```

- Modules: `/NycDot` (the DOT datasets and their row schemas) and
  `/NycOpenData` (the domain).

See the [API reference](https://github.com/mannyc2/nyc-transit-kit/blob/main/docs/api-reference.md).
