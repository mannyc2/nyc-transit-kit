import { exportNycDotDataset, queryNycDotDataset } from "@nyc-transit-kit/nyc-dot/datasets"
import { runSoda3Effect } from "./internal/runtime"
import type { Soda3CompatOptions } from "./soda3"

type NycDotQueryInput = Parameters<typeof queryNycDotDataset>[0]
type NycDotExportInput = Parameters<typeof exportNycDotDataset>[0]
export const queryNycDotRows = (input: NycDotQueryInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(queryNycDotDataset(input), options)
export const exportNycDotResponse = (input: NycDotExportInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(exportNycDotDataset(input), options)
