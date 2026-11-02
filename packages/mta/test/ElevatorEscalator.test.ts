import { expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as Effect from "effect/Effect"
import * as ElevatorEscalator from "../src/ElevatorEscalator"

// The MTA labels these JSON feeds with this literal content type.
// biome-ignore lint/suspicious/noTemplateCurlyInString: MTA sends this literal header.
const brokenContentType = { "content-type": "${header.s3FileType}" }

it.effect("outages decode although the MTA labels the JSON with a broken content type", () =>
  Effect.gen(function* () {
    const feed = ElevatorEscalator.feeds["elevator-escalator-current"]
    expect(yield* ElevatorEscalator.fetchRows(feed)).toEqual(Samples.elevatorOutageRows)
    const [request] = yield* HttpTest.requests
    expect(request?.url.href).toBe(feed.url)
  }).pipe(
    Effect.provide(
      HttpTest.layer(
        () =>
          new Response(JSON.stringify(Samples.elevatorOutageRows), {
            headers: brokenContentType
          })
      )
    )
  )
)

it.effect("equipment rows decode with their own schema", () =>
  Effect.gen(function* () {
    const rows = yield* ElevatorEscalator.fetchRows(
      ElevatorEscalator.feeds["elevator-escalator-equipment"]
    )
    expect(rows.map((row) => row.redundant)).toEqual(
      Samples.elevatorEquipmentRows.map((row) => row.redundant)
    )
  }).pipe(
    Effect.provide(
      HttpTest.layer(
        () =>
          new Response(JSON.stringify(Samples.elevatorEquipmentRows), {
            headers: brokenContentType
          })
      )
    )
  )
)

it.effect("outage rows are not equipment rows", () =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(
      ElevatorEscalator.fetchRows(ElevatorEscalator.feeds["elevator-escalator-equipment"])
    )
    expect(error._tag).toBe("SchemaError")
  }).pipe(Effect.provide(HttpTest.layer(() => Response.json(Samples.elevatorOutageRows))))
)
