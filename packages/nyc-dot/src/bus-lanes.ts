import { NycDotBusLaneRow } from "@nyc-transit-kit/contracts/nyc-dot"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { UnsupportedDatasetError } from "./errors"

export const decodeBusLaneRow = (input: unknown) =>
  Schema.decodeUnknownEffect(NycDotBusLaneRow)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        UnsupportedDatasetError.make({
          dataset: "bus-lanes-local-streets",
          message: error.message
        })
      )
    )
  )
