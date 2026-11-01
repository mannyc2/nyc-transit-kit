import { expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"
import * as BusTime from "../src/BusTime"

// Bus Time refuses a request without a key, and a request whose key it does not know.
it.effect("sends its key as the query parameter Bus Time requires", () =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(
      BusTime.fetchJson("vehicle-monitoring", Redacted.make("bus-key"), {
        LineRef: "MTA NYCT_B63"
      })
    )
    expect(error.reason._tag).toBe("StatusCodeError")
    const [request] = yield* HttpTest.requests
    expect(`${request?.url.origin}${request?.url.pathname}`).toBe(
      BusTime.feeds["vehicle-monitoring"].url
    )
    expect(request?.url.searchParams.get("key")).toBe("bus-key")
    expect(request?.url.searchParams.get("LineRef")).toBe("MTA NYCT_B63")
  }).pipe(
    Effect.provide(HttpTest.layer(() => Response.json(Samples.busTimeKeyRequired, { status: 401 })))
  )
)
