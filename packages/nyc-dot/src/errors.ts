import * as Schema from "effect/Schema"

export class UnsupportedDatasetError extends Schema.TaggedErrorClass<UnsupportedDatasetError>()(
  "UnsupportedDatasetError",
  {
    dataset: Schema.String,
    message: Schema.String
  }
) {}

export const isUnsupportedDatasetError = (value: unknown): value is UnsupportedDatasetError =>
  value instanceof UnsupportedDatasetError
