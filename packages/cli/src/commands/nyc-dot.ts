import type { Soda3ExportFormat } from "@nyc-transit-kit/contracts/soda3"
import { exportNycDotDataset, queryNycDotDataset } from "@nyc-transit-kit/nyc-dot/client"
import {
  findNycDotDataset,
  nycDotDatasets,
  nycDotOpenDataDomain
} from "@nyc-transit-kit/nyc-dot/datasets"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { failCommand, runEffect, soqlFromSelect, writeSuccess } from "./shared"
import { writeResponseToFile, writeSoda3ExportDryRun, writeSoda3QueryDryRun } from "./soda3-shared"
import { CliCommandContext } from "./types"

export const nycDotCommandPaths: ReadonlyArray<ReadonlyArray<string>> = [
  ["nyc-dot", "dataset", "list"],
  ["nyc-dot", "dataset", "info"],
  ["nyc-dot", "dataset", "query"],
  ["nyc-dot", "dataset", "export"]
]

export const handleNycDotList = () =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    return yield* writeSuccess(context, "nyc-dot", {
      datasets: nycDotDatasets
    })
  })

export const handleNycDotInfo = (config: { readonly name: string }) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const descriptor = findNycDotDataset(config.name)

    if (descriptor === undefined) {
      return yield* failCommand(
        context,
        "nyc-dot",
        "unsupported-dataset",
        `Unsupported NYC DOT dataset: ${config.name}`,
        ["nyc-dot", "dataset", "info"]
      )
    }

    return yield* writeSuccess(context, "nyc-dot", descriptor)
  })

export const handleNycDotQuery = (config: {
  readonly name: string
  readonly select: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["nyc-dot", "dataset", "query"]
    const descriptor = findNycDotDataset(config.name)

    if (descriptor === undefined) {
      return yield* failCommand(
        context,
        "nyc-dot",
        "unsupported-dataset",
        `Unsupported NYC DOT dataset: ${config.name}`,
        tokens
      )
    }

    const request = {
      name: config.name,
      query: soqlFromSelect(config.select)
    }

    if (config.dryRun) {
      return yield* writeSoda3QueryDryRun({
        context,
        apiFamily: "nyc-dot",
        tokens,
        domain: nycDotOpenDataDomain,
        datasetId: String(descriptor.id),
        query: request.query,
        extra: {
          dataset: descriptor
        }
      })
    }

    return yield* runEffect(
      context,
      "nyc-dot",
      tokens,
      queryNycDotDataset(request).pipe(Effect.provide(context.runtime.soda3Layer))
    )
  })

export const handleNycDotExport = (config: {
  readonly name: string
  readonly format: Soda3ExportFormat
  readonly output: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["nyc-dot", "dataset", "export"]
    const descriptor = findNycDotDataset(config.name)

    if (descriptor === undefined) {
      return yield* failCommand(
        context,
        "nyc-dot",
        "unsupported-dataset",
        `Unsupported NYC DOT dataset: ${config.name}`,
        tokens
      )
    }

    const request = {
      name: config.name,
      format: config.format
    }

    if (config.dryRun) {
      return yield* writeSoda3ExportDryRun({
        context,
        apiFamily: "nyc-dot",
        tokens,
        domain: nycDotOpenDataDomain,
        datasetId: String(descriptor.id),
        format: request.format,
        output: config.output,
        extra: {
          dataset: descriptor
        }
      })
    }

    return yield* runEffect(
      context,
      "nyc-dot",
      tokens,
      Effect.gen(function* () {
        const response = yield* exportNycDotDataset(request).pipe(
          Effect.provide(context.runtime.soda3Layer)
        )
        return yield* writeResponseToFile(config.output, response)
      })
    )
  })

const nycDotDatasetListCommand = Command.make("list", {}, handleNycDotList).pipe(
  Command.withShortDescription("List curated NYC DOT dataset descriptors.")
)

const nycDotDatasetInfoCommand = Command.make(
  "info",
  {
    name: Flag.string("name").pipe(
      Flag.withDescription("Known NYC DOT dataset name, such as traffic-speeds.")
    )
  },
  handleNycDotInfo
).pipe(Command.withShortDescription("Show NYC DOT dataset metadata."))

const nycDotDatasetQueryCommand = Command.make(
  "query",
  {
    name: Flag.string("name").pipe(
      Flag.withDescription("Known NYC DOT dataset name, such as traffic-speeds.")
    ),
    select: Flag.string("select").pipe(
      Flag.withDescription("SoQL select expression or full SELECT query.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleNycDotQuery
).pipe(Command.withShortDescription("Run a NYC DOT SODA3 query."))

const nycDotDatasetExportCommand = Command.make(
  "export",
  {
    name: Flag.string("name").pipe(
      Flag.withDescription("Known NYC DOT dataset name, such as traffic-speeds.")
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
  handleNycDotExport
).pipe(Command.withShortDescription("Export a NYC DOT dataset."))

const nycDotDatasetCommand = Command.make("dataset").pipe(
  Command.withShortDescription("NYC DOT dataset commands."),
  Command.withSubcommands([
    nycDotDatasetListCommand,
    nycDotDatasetInfoCommand,
    nycDotDatasetQueryCommand,
    nycDotDatasetExportCommand
  ])
)

export const nycDotCommand = Command.make("nyc-dot").pipe(
  Command.withShortDescription("NYC DOT commands."),
  Command.withSubcommands([nycDotDatasetCommand])
)
