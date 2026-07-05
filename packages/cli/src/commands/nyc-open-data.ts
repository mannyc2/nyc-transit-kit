import {
  exportNycOpenDataDataset,
  queryNycOpenDataDataset,
  searchNycOpenDataCatalog
} from "@nyc-transit-kit/nyc-open-data/client"
import {
  defaultDomain,
  findNycOpenDataDataset,
  knownNycOpenDataDatasets
} from "@nyc-transit-kit/nyc-open-data/descriptors"
import { buildCatalogSearchUrl } from "@nyc-transit-kit/soda3/endpoints"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { CliCommandContext, dryRunFlag, makeDatasetCommands, runEffect } from "./shared"

const handleNycOpenDataCatalogSearch = (config: {
  readonly query: string
  readonly limit: number
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["nyc-open-data", "catalog", "search"]
    const request = {
      query: config.query,
      limit: config.limit
    }

    if (config.dryRun) {
      return yield* runEffect(
        context,
        "nyc-open-data",
        tokens,
        buildCatalogSearchUrl({
          domain: defaultDomain,
          ...request
        }).pipe(
          Effect.map((url) => ({
            dryRun: true,
            method: "GET",
            url: url.toString()
          }))
        )
      )
    }

    return yield* runEffect(
      context,
      "nyc-open-data",
      tokens,
      searchNycOpenDataCatalog(request).pipe(Effect.provide(context.runtime.soda3Layer))
    )
  })

const nycOpenDataDatasetCommands = makeDatasetCommands({
  family: "nyc-open-data",
  tokens: ["nyc-open-data", "dataset"],
  idConfigKey: "datasetId",
  idFlagName: "dataset",
  idFlagDescription: "NYC Open Data Socrata dataset id.",
  domain: defaultDomain,
  listShortDescription: "List curated NYC Open Data descriptors.",
  infoShortDescription: "Show NYC Open Data dataset metadata.",
  queryShortDescription: "Run a NYC Open Data SODA3 query.",
  exportShortDescription: "Export a NYC Open Data dataset.",
  listPayload: () => ({ datasets: knownNycOpenDataDatasets }),
  infoPayload: (datasetId) => {
    const descriptor = findNycOpenDataDataset(datasetId)
    return {
      payload: {
        known: descriptor !== undefined,
        descriptor:
          descriptor === undefined
            ? {
                id: datasetId,
                domain: defaultDomain,
                backing: "socrata"
              }
            : descriptor
      }
    }
  },
  resolveDataset: (datasetId) => ({
    payload: {
      datasetId
    }
  }),
  query: ({ id, query }) =>
    queryNycOpenDataDataset({
      datasetId: id,
      query
    }),
  exportResponse: ({ id, format }) =>
    exportNycOpenDataDataset({
      datasetId: id,
      format
    })
})

const nycOpenDataCatalogSearchCommand = Command.make(
  "search",
  {
    query: Flag.string("query").pipe(Flag.withDescription("Search text for NYC Open Data.")),
    limit: Flag.integer("limit").pipe(
      Flag.withDefault(10),
      Flag.withDescription("Maximum catalog results to request. Defaults to 10.")
    ),
    dryRun: dryRunFlag
  },
  handleNycOpenDataCatalogSearch
).pipe(Command.withShortDescription("Search the NYC Open Data catalog."))

const nycOpenDataCatalogCommand = Command.make("catalog").pipe(
  Command.withShortDescription("NYC Open Data catalog commands."),
  Command.withSubcommands([nycOpenDataCatalogSearchCommand])
)

const nycOpenDataDatasetCommand = Command.make("dataset").pipe(
  Command.withShortDescription("NYC Open Data dataset commands."),
  Command.withSubcommands(nycOpenDataDatasetCommands)
)

export const nycOpenDataCommand = Command.make("nyc-open-data").pipe(
  Command.withShortDescription("NYC Open Data commands."),
  Command.withSubcommands([nycOpenDataCatalogCommand, nycOpenDataDatasetCommand])
)
