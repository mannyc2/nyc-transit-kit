import type { Soda3ExportFormat } from "@nyc-transit-kit/contracts/soda3"
import { buildCatalogSearchUrl, catalogSearch } from "@nyc-transit-kit/soda3/catalog"
import { buildExportUrl } from "@nyc-transit-kit/soda3/endpoints"
import { exportResponse } from "@nyc-transit-kit/soda3/export"
import { queryRows } from "@nyc-transit-kit/soda3/query"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import {
  CliCommandContext,
  domainFlag,
  dryRunFlag,
  formatFlag,
  outputFlag,
  runEffect,
  selectFlag,
  soqlFromSelect,
  writeResponseToFile,
  writeSoda3ExportDryRun,
  writeSoda3QueryDryRun,
  writeSuccess
} from "./shared"

export const handleSocrataQuery = (config: {
  readonly domain: string
  readonly datasetId: string
  readonly select: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["socrata", "query"]
    const request = {
      domain: config.domain,
      datasetId: config.datasetId,
      query: soqlFromSelect(config.select)
    }

    if (config.dryRun) {
      return yield* writeSoda3QueryDryRun({
        context,
        apiFamily: "socrata",
        tokens,
        ...request
      })
    }

    return yield* runEffect(
      context,
      "socrata",
      tokens,
      queryRows(request).pipe(Effect.provide(context.runtime.soda3Layer))
    )
  })

export const handleSocrataExport = (config: {
  readonly domain: string
  readonly datasetId: string
  readonly format: Soda3ExportFormat
  readonly output: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["socrata", "export"]
    const request = {
      domain: config.domain,
      datasetId: config.datasetId,
      format: config.format
    }

    if (config.dryRun) {
      return yield* writeSoda3ExportDryRun({
        context,
        apiFamily: "socrata",
        tokens,
        output: config.output,
        ...request
      })
    }

    return yield* runEffect(
      context,
      "socrata",
      tokens,
      Effect.gen(function* () {
        const response = yield* exportResponse(request).pipe(
          Effect.provide(context.runtime.soda3Layer)
        )
        return yield* writeResponseToFile(config.output, response)
      })
    )
  })

export const handleSocrataRangeProbe = (config: {
  readonly domain: string
  readonly datasetId: string
  readonly format: Soda3ExportFormat
  readonly rangeEnd: number
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["socrata", "range-probe"]
    const request = {
      domain: config.domain,
      datasetId: config.datasetId,
      format: config.format,
      range: {
        start: 0,
        end: config.rangeEnd
      }
    }
    const url = yield* buildExportUrl(request)

    if (config.dryRun) {
      return yield* writeSuccess(context, "socrata", {
        dryRun: true,
        method: "POST",
        url: url.toString(),
        headers: {
          range: `bytes=0-${config.rangeEnd}`
        }
      })
    }

    return yield* runEffect(
      context,
      "socrata",
      tokens,
      Effect.gen(function* () {
        const response = yield* exportResponse(request).pipe(
          Effect.provide(context.runtime.soda3Layer)
        )
        const body = yield* Effect.promise(() => response.arrayBuffer())
        return {
          status: response.status,
          byteLength: body.byteLength
        }
      })
    )
  })

const handleCatalogSearch = (config: {
  readonly domain: string
  readonly query: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["catalog", "search"]
    const request = {
      domain: config.domain,
      query: config.query
    }
    const url = yield* buildCatalogSearchUrl(request)

    if (config.dryRun) {
      return yield* writeSuccess(context, "socrata", {
        dryRun: true,
        method: "GET",
        url: url.toString()
      })
    }

    return yield* runEffect(
      context,
      "socrata",
      tokens,
      catalogSearch(request).pipe(Effect.provide(context.runtime.soda3Layer))
    )
  })

const socrataQueryCommand = Command.make(
  "query",
  {
    domain: domainFlag,
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("Socrata dataset id, such as ycrg-ses3.")
    ),
    select: selectFlag,
    dryRun: dryRunFlag
  },
  handleSocrataQuery
).pipe(Command.withShortDescription("Run a SODA3 query."))

const socrataExportCommand = Command.make(
  "export",
  {
    domain: domainFlag,
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("Socrata dataset id, such as ycrg-ses3.")
    ),
    format: formatFlag,
    output: outputFlag,
    dryRun: dryRunFlag
  },
  handleSocrataExport
).pipe(Command.withShortDescription("Export a SODA3 dataset."))

const socrataRangeProbeCommand = Command.make(
  "range-probe",
  {
    domain: domainFlag,
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("Socrata dataset id, such as ycrg-ses3.")
    ),
    format: formatFlag,
    rangeEnd: Flag.integer("range-end").pipe(
      Flag.withDescription("Inclusive byte offset for a bytes=0-N range probe.")
    ),
    dryRun: dryRunFlag
  },
  handleSocrataRangeProbe
).pipe(Command.withShortDescription("Probe SODA3 export range support."))

export const socrataCommand = Command.make("socrata").pipe(
  Command.withShortDescription("Socrata SODA3 commands."),
  Command.withSubcommands([socrataQueryCommand, socrataExportCommand, socrataRangeProbeCommand])
)

const catalogSearchCommand = Command.make(
  "search",
  {
    domain: domainFlag,
    query: Flag.string("query").pipe(
      Flag.withDescription("Search text for Socrata Discovery API.")
    ),
    dryRun: dryRunFlag
  },
  handleCatalogSearch
).pipe(Command.withShortDescription("Search a Socrata catalog."))

export const catalogCommand = Command.make("catalog").pipe(
  Command.withShortDescription("Socrata catalog commands."),
  Command.withSubcommands([catalogSearchCommand])
)
