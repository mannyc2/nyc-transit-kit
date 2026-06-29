import { MtaOpenDataCatalogRow } from "@nyc-transit-kit/contracts/mta"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { MtaInvalidInputError } from "./errors"

const operation = "mta-open-data-catalog"

export const decodeMtaOpenDataCatalogRow = (input: unknown) =>
  Schema.decodeUnknownEffect(MtaOpenDataCatalogRow)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        MtaInvalidInputError.make({
          operation,
          message: error.message
        })
      )
    )
  )

export const decodeMtaOpenDataCatalogRows = (inputs: ReadonlyArray<unknown>) =>
  Effect.all(inputs.map((input) => decodeMtaOpenDataCatalogRow(input)))
