import type { Soda3ExportFormat } from "@nyc-transit-kit/contracts/soda3"
import { searchNycOpenDataCatalog } from "@nyc-transit-kit/nyc-open-data/catalog"
import { exportNycOpenDataDataset } from "@nyc-transit-kit/nyc-open-data/client"
import {
  defaultDomain,
  findNycOpenDataDataset,
  knownNycOpenDataDatasets
} from "@nyc-transit-kit/nyc-open-data/descriptors"
import { queryNycOpenDataDataset } from "@nyc-transit-kit/nyc-open-data/query"
import { buildCatalogSearchUrl } from "@nyc-transit-kit/soda3/endpoints"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { runEffect, soqlFromSelect, writeSuccess } from "./shared"
import { writeResponseToFile, writeSoda3ExportDryRun, writeSoda3QueryDryRun } from "./soda3-shared"
import { CliCommandContext } from "./types"

export const nycOpenDataCommandPaths: ReadonlyArray<ReadonlyArray<string>> = [
  ["nyc-open-data", "catalog", "search"],
  ["nyc-open-data", "dataset", "list"],
  ["nyc-open-data", "dataset", "info"],
  ["nyc-open-data", "dataset", "query"],
  ["nyc-open-data", "dataset", "export"]
]

export const handleNycOpenDataCatalogSearch = (config: {
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

export const handleNycOpenDataList = () =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    return yield* writeSuccess(context, "nyc-open-data", {
      datasets: knownNycOpenDataDatasets
    })
  })

export const handleNycOpenDataInfo = (config: { readonly datasetId: string }) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const descriptor = findNycOpenDataDataset(config.datasetId)

    return yield* writeSuccess(context, "nyc-open-data", {
      known: descriptor !== undefined,
      descriptor:
        descriptor === undefined
          ? {
              id: config.datasetId,
              domain: defaultDomain,
              backing: "socrata"
            }
          : descriptor
    })
  })

export const handleNycOpenDataQuery = (config: {
  readonly datasetId: string
  readonly select: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["nyc-open-data", "dataset", "query"]
    const request = {
      datasetId: config.datasetId,
      query: soqlFromSelect(config.select)
    }

    if (config.dryRun) {
      return yield* writeSoda3QueryDryRun({
        context,
        apiFamily: "nyc-open-data",
        tokens,
        domain: defaultDomain,
        ...request
      })
    }

    return yield* runEffect(
      context,
      "nyc-open-data",
      tokens,
      queryNycOpenDataDataset(request).pipe(Effect.provide(context.runtime.soda3Layer))
    )
  })

export const handleNycOpenDataExport = (config: {
  readonly datasetId: string
  readonly format: Soda3ExportFormat
  readonly output: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["nyc-open-data", "dataset", "export"]
    const request = {
      datasetId: config.datasetId,
      format: config.format
    }

    if (config.dryRun) {
      return yield* writeSoda3ExportDryRun({
        context,
        apiFamily: "nyc-open-data",
        tokens,
        domain: defaultDomain,
        output: config.output,
        ...request
      })
    }

    return yield* runEffect(
      context,
      "nyc-open-data",
      tokens,
      Effect.gen(function* () {
        const response = yield* exportNycOpenDataDataset(request).pipe(
          Effect.provide(context.runtime.soda3Layer)
        )
        return yield* writeResponseToFile(config.output, response)
      })
    )
  })

const nycOpenDataCatalogSearchCommand = Command.make(
  "search",
  {
    query: Flag.string("query").pipe(Flag.withDescription("Search text for NYC Open Data.")),
    limit: Flag.integer("limit").pipe(
      Flag.withDefault(10),
      Flag.withDescription("Maximum catalog results to request. Defaults to 10.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleNycOpenDataCatalogSearch
).pipe(Command.withShortDescription("Search the NYC Open Data catalog."))

const nycOpenDataCatalogCommand = Command.make("catalog").pipe(
  Command.withShortDescription("NYC Open Data catalog commands."),
  Command.withSubcommands([nycOpenDataCatalogSearchCommand])
)

const nycOpenDataDatasetListCommand = Command.make("list", {}, handleNycOpenDataList).pipe(
  Command.withShortDescription("List curated NYC Open Data descriptors.")
)

const nycOpenDataDatasetInfoCommand = Command.make(
  "info",
  {
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("NYC Open Data Socrata dataset id.")
    )
  },
  handleNycOpenDataInfo
).pipe(Command.withShortDescription("Show NYC Open Data dataset metadata."))

const nycOpenDataDatasetQueryCommand = Command.make(
  "query",
  {
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("NYC Open Data Socrata dataset id.")
    ),
    select: Flag.string("select").pipe(
      Flag.withDescription("SoQL select expression or full SELECT query.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleNycOpenDataQuery
).pipe(Command.withShortDescription("Run a NYC Open Data SODA3 query."))

const nycOpenDataDatasetExportCommand = Command.make(
  "export",
  {
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("NYC Open Data Socrata dataset id.")
    ),
    format: Flag.choice("format", ["csv", "json", "geojson"]).pipe(
      Flag.withDefault("csv"),
      Flag.withDescription("Export format. Defaults to csv.")
    ),
    output: Flag.string("output").pipe(
      Flag.withDescription("Destination file path for the downloaded response body.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleNycOpenDataExport
).pipe(Command.withShortDescription("Export a NYC Open Data dataset."))

const nycOpenDataDatasetCommand = Command.make("dataset").pipe(
  Command.withShortDescription("NYC Open Data dataset commands."),
  Command.withSubcommands([
    nycOpenDataDatasetListCommand,
    nycOpenDataDatasetInfoCommand,
    nycOpenDataDatasetQueryCommand,
    nycOpenDataDatasetExportCommand
  ])
)

export const nycOpenDataCommand = Command.make("nyc-open-data").pipe(
  Command.withShortDescription("NYC Open Data commands."),
  Command.withSubcommands([nycOpenDataCatalogCommand, nycOpenDataDatasetCommand])
)
