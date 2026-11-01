import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import * as Output from "../Output"
import {
  appTokenFlag,
  datasetIdFlag,
  domainFlag,
  exportRows,
  formatFlag,
  outputFlag,
  queryRows,
  searchCatalog,
  searchLimitFlag,
  searchQueryFlag,
  selectFlag
} from "./Shared"

const queryCommand = Command.make(
  "query",
  { domain: domainFlag, datasetId: datasetIdFlag, select: selectFlag, appToken: appTokenFlag },
  ({ domain, datasetId, select, appToken }) =>
    queryRows("socrata", { domain, datasetId }, select).pipe(
      Effect.provide(Soda3Client.layer({ appToken }))
    )
).pipe(Command.withShortDescription("Run a SODA3 query."))

const exportCommand = Command.make(
  "export",
  {
    domain: domainFlag,
    datasetId: datasetIdFlag,
    format: formatFlag,
    output: outputFlag("File to write the export to."),
    appToken: appTokenFlag
  },
  ({ domain, datasetId, format, output, appToken }) =>
    exportRows("socrata", { domain, datasetId }, format, output).pipe(
      Effect.provide(Soda3Client.layer({ appToken }))
    )
).pipe(Command.withShortDescription("Export a SODA3 dataset to a file."))

const rangeProbeCommand = Command.make(
  "range-probe",
  {
    domain: domainFlag,
    datasetId: datasetIdFlag,
    format: formatFlag,
    rangeEnd: Flag.Int("range-end").pipe(
      Flag.withDescription("Last byte of the probe range, as in Range: bytes=0-N.")
    ),
    appToken: appTokenFlag
  },
  ({ domain, datasetId, format, rangeEnd, appToken }) =>
    Effect.gen(function* () {
      const soda = yield* Soda3Client.Soda3Client
      const requestedBytes = rangeEnd + 1
      // Stops reading past the range: a server that ignores Range sends the whole export.
      const receivedBytes = yield* soda
        .export({ domain, datasetId, format, range: { start: 0, end: rangeEnd } })
        .pipe(
          Stream.scan(
            () => 0,
            (total, chunk: Uint8Array) => total + chunk.byteLength
          ),
          Stream.takeUntil((total) => total > requestedBytes),
          Stream.runLast,
          Effect.map(Option.getOrElse(() => 0))
        )
      yield* Output.success("socrata", {
        range: `bytes=0-${rangeEnd}`,
        requestedBytes,
        receivedBytes
      })
    }).pipe(Effect.provide(Soda3Client.layer({ appToken })))
).pipe(
  Command.withShortDescription("Check whether a SODA3 export honors HTTP Range."),
  Command.withDescription(
    "Requests bytes 0..N of an export. receivedBytes above requestedBytes means the server ignored the range."
  )
)

export const socrataCommand = Command.make("socrata").pipe(
  Command.withShortDescription("SODA3 query and export on any Socrata domain."),
  Command.withSubcommands([queryCommand, exportCommand, rangeProbeCommand])
)

export const catalogCommand = Command.make("catalog").pipe(
  Command.withShortDescription("Socrata Discovery API commands."),
  Command.withSubcommands([
    Command.make(
      "search",
      { domain: domainFlag, query: searchQueryFlag, limit: searchLimitFlag },
      (search) => searchCatalog("socrata", search)
    ).pipe(Command.withShortDescription("Search a Socrata catalog."))
  ])
)
