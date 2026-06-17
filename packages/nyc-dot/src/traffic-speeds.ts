import { NycDotTrafficSpeedRow } from "@nyc-transit-kit/contracts/nyc-dot"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { UnsupportedDatasetError } from "./errors"

export const decodeTrafficSpeedRow = (input: unknown) =>
  Schema.decodeUnknownEffect(NycDotTrafficSpeedRow)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        UnsupportedDatasetError.make({
          dataset: "traffic-speeds",
          message: error.message
        })
      )
    )
  )
