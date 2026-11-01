/**
 * MTA Bus Time SIRI JSON. Requests need a Bus Time API key; responses are not modelled.
 */
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import type * as Redacted from "effect/Redacted"

export const feeds = {
  "vehicle-monitoring": {
    title: "Bus Time SIRI vehicle monitoring",
    url: "https://bustime.mta.info/api/siri/vehicle-monitoring.json"
  },
  "stop-monitoring": {
    title: "Bus Time SIRI stop monitoring",
    url: "https://bustime.mta.info/api/siri/stop-monitoring.json"
  }
}
export type FeedName = keyof typeof feeds

/** The feed as raw JSON. `key` travels as a query parameter, as Bus Time requires. */
export const fetchJson = Effect.fn("BusTime.fetchJson")(function* (
  name: FeedName,
  key: Redacted.Redacted,
  query: Readonly<Record<string, string>> = {}
) {
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)
  const response = yield* client.get(feeds[name].url, { urlParams: { ...query, key } })
  return yield* response.json
})
