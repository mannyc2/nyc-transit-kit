import * as NycDot from "@nyc-transit-kit/nyc-open-data/NycDot"
import * as NycOpenData from "@nyc-transit-kit/nyc-open-data/NycOpenData"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Record from "effect/Record"
import {
  datasetCommands,
  datasetIdFlag,
  searchCatalog,
  searchLimitFlag,
  searchQueryFlag
} from "./Shared"

export const nycOpenDataCommand = Command.make("nyc-open-data").pipe(
  Command.withShortDescription("NYC Open Data (data.cityofnewyork.us)."),
  Command.withSubcommands([
    Command.make("catalog").pipe(
      Command.withShortDescription("NYC Open Data catalog commands."),
      Command.withSubcommands([
        Command.make("search", { query: searchQueryFlag, limit: searchLimitFlag }, (search) =>
          searchCatalog("nyc-open-data", { ...search, domain: NycOpenData.domain })
        ).pipe(Command.withShortDescription("Search the NYC Open Data catalog."))
      ])
    ),
    Command.make("dataset").pipe(
      Command.withShortDescription("NYC Open Data dataset commands."),
      Command.withSubcommands(
        datasetCommands({
          apiFamily: "nyc-open-data",
          label: "NYC Open Data",
          datasets: NycOpenData.datasets,
          select: datasetIdFlag.pipe(
            Flag.map((datasetId) => ({ domain: NycOpenData.domain, datasetId }))
          )
        })
      )
    )
  ])
)

export const nycDotCommand = Command.make("nyc-dot").pipe(
  Command.withShortDescription("NYC DOT datasets on NYC Open Data."),
  Command.withSubcommands([
    Command.make("dataset").pipe(
      Command.withShortDescription("NYC DOT dataset commands."),
      Command.withSubcommands(
        datasetCommands({
          apiFamily: "nyc-dot",
          label: "NYC DOT",
          datasets: NycDot.datasets,
          select: Flag.Literals("name", Record.keys(NycDot.datasets)).pipe(
            Flag.withDescription("Dataset name; see `list`."),
            Flag.map((name) => NycDot.datasets[name])
          )
        })
      )
    )
  ])
)
