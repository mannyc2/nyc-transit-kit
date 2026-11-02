# @nyc-transit-kit/fixtures

Small real responses from the APIs the kit wraps, and an `HttpClient` for
tests that answers from them.

```ts
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"

const url = "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9/query.json"

export const program = Effect.gen(function* () {
  const response = yield* HttpClient.post(url)
  const requests = yield* HttpTest.requests
  return { rows: yield* response.json, requests }
}).pipe(Effect.provide(HttpTest.layer(() => Response.json(Samples.trafficSpeedRows))))
```

- `HttpTest.layer(handler)` answers each request with `handler` and records it;
  `HttpTest.requests` reads what was sent.
- `HttpTest.soda3(handler)` refuses what SODA3 refuses, with its real answers:
  a request without `X-App-Token` gets the 403, `export.json` and
  `export.geojson` the 406, and paging with `orderingSpecifier: "discard"` the
  400.
- Modules: `/Samples` and `/HttpTest`.

Every sample was captured from the live API and cut down to a few rows; the
comment above each one says where it came from and when. Do not hand-write
samples: a made-up row matches a made-up schema, which is how wrong column
names once passed every test. Refresh a sample by capturing it again.

Do not add full datasets, secrets, private data or large exports.

`effect` is a peer dependency; the package has no other.
