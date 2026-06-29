import { MtaElevatorEscalatorCurrent } from "@nyc-transit-kit/contracts/mta"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { MtaInvalidInputError } from "./errors"

const operation = "elevator-escalator-current"

export const decodeMtaElevatorEscalatorCurrent = (input: unknown) =>
  Schema.decodeUnknownEffect(MtaElevatorEscalatorCurrent)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        MtaInvalidInputError.make({
          operation,
          message: error.message
        })
      )
    )
  )
