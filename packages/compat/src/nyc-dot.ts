import { queryNycDotDataset } from "@nyc-transit-kit/nyc-dot/client"
import { runSoda3Effect } from "./internal/run"
import type { Soda3CompatOptions } from "./soda3"

export { isUnsupportedDatasetError, UnsupportedDatasetError } from "@nyc-transit-kit/nyc-dot/errors"

export const queryNycDotRows = (
  input: {
    readonly name: string
    readonly query: string
  },
  options?: Soda3CompatOptions
) => runSoda3Effect(queryNycDotDataset(input), options)
