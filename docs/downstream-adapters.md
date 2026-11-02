# Downstream Adapters

Downstream applications use the toolkit without moving their product logic into
it. For every export, see the [API reference](api-reference.md); for install
and the Effect version each release needs, see
[Getting started](getting-started.md#compatibility).

## From Effect Code

Provide the layers once, where the app starts, and use the functions anywhere
below. This needs a `Soda3Client` layer, as in Getting started:

```ts
import * as NycDot from "@nyc-transit-kit/nyc-open-data/NycDot"
import * as Dataset from "@nyc-transit-kit/soda3/Dataset"
import * as Soql from "@nyc-transit-kit/soda3/Soql"
import * as Stream from "effect/Stream"

// Your own type: the toolkit's rows stay at the edge of your app.
interface LaneSegment {
  readonly street: string
  readonly hours: string
}

export const queensBusLanes = Dataset.stream(NycDot.datasets["bus-lanes-local-streets"], {
  where: Soql.eq("boro", "QNS")
}).pipe(
  Stream.map((row): LaneSegment => ({ street: row.street, hours: row.hours })),
  Stream.runCollect
)
```

Map provider rows into your own types at that edge. A provider renaming a
column then breaks one function instead of your whole app.

## From Promise Code

There is no Promise package. Build a `ManagedRuntime` once and run programs
through it:

```ts
import * as NycDot from "@nyc-transit-kit/nyc-open-data/NycDot"
import * as Dataset from "@nyc-transit-kit/soda3/Dataset"
import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Redacted from "effect/Redacted"

export const makeTransitClient = (appToken: string) => {
  const runtime = ManagedRuntime.make(
    Soda3Client.layer({ appToken: Redacted.make(appToken) }).pipe(
      Layer.provide(FetchHttpClient.layer)
    )
  )
  return {
    latestSpeeds: (limit: number) =>
      runtime.runPromise(Dataset.query(NycDot.datasets["traffic-speeds"], { limit })),
    close: () => runtime.dispose()
  }
}
```

A rejected Promise carries the same typed error the Effect failed with, such as
`SocrataError` with Socrata's message.

## Keep Local To Downstreams

Analytics, database projections, detector logic, route scoring, route briefs,
product UI, hosted pipelines and document extraction stay in their own
repositories.
