import {
  NycDotBusLaneRow,
  NycDotTrafficSpeedRow,
  NycDotTrafficVolumeRow
} from "@nyc-transit-kit/contracts/descriptors"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { UnsupportedDatasetError } from "./datasets"

const decodeRow =
  <S extends Schema.Top>(dataset: string, schema: S) =>
  (input: unknown) =>
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.catchTag("SchemaError", (error) =>
        Effect.fail(UnsupportedDatasetError.make({ dataset, message: error.message }))
      )
    )

export const decodeBusLaneRow = decodeRow("bus-lanes-local-streets", NycDotBusLaneRow)
export const decodeTrafficSpeedRow = decodeRow("traffic-speeds", NycDotTrafficSpeedRow)
export const decodeTrafficVolumeRow = decodeRow("traffic-volume-counts", NycDotTrafficVolumeRow)
