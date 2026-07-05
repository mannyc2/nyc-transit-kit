import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { InvalidInputError } from "../errors"

export const decodeInput =
  <S extends Schema.Top>(operation: string, schema: S) =>
  (input: unknown) =>
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.catchTag("SchemaError", (error) =>
        Effect.fail(InvalidInputError.make({ operation, message: error.message }))
      )
    )
