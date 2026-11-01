# @nyc-transit-kit/soda3

Effect client for Socrata on any domain: SODA3 query and export, Discovery
catalog search, and SoQL built as `effect/sql` Statement fragments whose values
are written as SoQL literals. It speaks SODA3 alone; the legacy row endpoints
are not supported.

```sh
bun add effect@^4.0.6 @nyc-transit-kit/soda3
```

```ts
import * as Socrata from "@nyc-transit-kit/soda3/Socrata"
import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as Soql from "@nyc-transit-kit/soda3/Soql"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"

const rows = Effect.gen(function* () {
  const soda = yield* Soda3Client.Soda3Client
  return yield* soda.query({
    domain: Socrata.SocrataDomain.make("data.ny.gov"),
    datasetId: Socrata.SocrataDatasetId.make("f462-ka72"),
    query: Soql.soql`SELECT dataset_title, status WHERE ${Soql.eq("agency", "New York City Transit")} LIMIT 5`
  })
})

export const program = rows.pipe(
  Effect.provide(
    Soda3Client.layer({ appToken: Redacted.make("your-app-token") }).pipe(
      Layer.provide(FetchHttpClient.layer)
    )
  )
)
```

- SODA3 refuses query and export without an app token, so
  `Soda3Client.layer` requires one. `Discovery.search` needs none.
- Refusals fail with `SocrataError`, which keeps Socrata's own sentence, such
  as "This request must be authenticated or have an application token".
- Nothing retries or times out on its own; compose `HttpClient.retryTransient`
  and `Effect.timeout` where you run it.
- Modules: `/Soda3Client`, `/Dataset`, `/Discovery`, `/Soql`, `/Socrata`.

See the [API reference](https://github.com/mannyc2/nyc-transit-kit/blob/main/docs/api-reference.md).
