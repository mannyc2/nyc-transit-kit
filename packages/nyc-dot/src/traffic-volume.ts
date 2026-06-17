import { NycDotTrafficVolumeRow } from "@nyc-transit-kit/contracts/nyc-dot"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { UnsupportedDatasetError } from "./errors"

export const decodeTrafficVolumeRow = (input: unknown) =>
  Schema.decodeUnknownEffect(NycDotTrafficVolumeRow)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        UnsupportedDatasetError.make({
          dataset: "traffic-volume-counts",
          message: error.message
        })
      )
    )
  )
