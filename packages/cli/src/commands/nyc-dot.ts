import {
  exportNycDotDataset,
  findNycDotDataset,
  nycDotDatasets,
  nycDotOpenDataDomain,
  queryNycDotDataset
} from "@nyc-transit-kit/nyc-dot/datasets"
import * as Command from "effect/unstable/cli/Command"
import { makeDatasetCommands } from "./shared"

const unsupportedDataset = (name: string) => ({
  code: "unsupported-dataset",
  message: `Unsupported NYC DOT dataset: ${name}`
})

const resolveNycDotDataset = (name: string) => {
  const descriptor = findNycDotDataset(name)
  return descriptor === undefined
    ? { failure: unsupportedDataset(name) }
    : {
        payload: {
          datasetId: String(descriptor.id),
          extra: {
            dataset: descriptor
          }
        }
      }
}

const nycDotDatasetCommands = makeDatasetCommands({
  family: "nyc-dot",
  tokens: ["nyc-dot", "dataset"],
  idConfigKey: "name",
  idFlagName: "name",
  idFlagDescription: "Known NYC DOT dataset name, such as traffic-speeds.",
  domain: nycDotOpenDataDomain,
  listShortDescription: "List curated NYC DOT dataset descriptors.",
  infoShortDescription: "Show NYC DOT dataset metadata.",
  queryShortDescription: "Run a NYC DOT SODA3 query.",
  exportShortDescription: "Export a NYC DOT dataset.",
  listPayload: () => ({ datasets: nycDotDatasets }),
  infoPayload: (name) => {
    const descriptor = findNycDotDataset(name)
    return descriptor === undefined
      ? { failure: unsupportedDataset(name) }
      : { payload: descriptor }
  },
  resolveDataset: resolveNycDotDataset,
  query: ({ id, query }) =>
    queryNycDotDataset({
      name: id,
      query
    }),
  exportResponse: ({ id, format }) =>
    exportNycDotDataset({
      name: id,
      format
    })
})

const nycDotDatasetCommand = Command.make("dataset").pipe(
  Command.withShortDescription("NYC DOT dataset commands."),
  Command.withSubcommands(nycDotDatasetCommands)
)

export const nycDotCommand = Command.make("nyc-dot").pipe(
  Command.withShortDescription("NYC DOT commands."),
  Command.withSubcommands([nycDotDatasetCommand])
)
