import type { Soda3ExportFormat } from "@nyc-transit-kit/contracts/soda3"
import { buildExportUrl } from "@nyc-transit-kit/soda3/endpoints"
import { exportResponse } from "@nyc-transit-kit/soda3/export"
import { queryRows } from "@nyc-transit-kit/soda3/query"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { runEffect, soqlFromSelect, writeSuccess } from "./shared"
import { writeResponseToFile, writeSoda3ExportDryRun, writeSoda3QueryDryRun } from "./soda3-shared"
import { CliCommandContext } from "./types"

export const socrataCommandPaths: ReadonlyArray<ReadonlyArray<string>> = [
  ["socrata", "query"],
  ["socrata", "export"],
  ["socrata", "range-probe"]
]

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

const socrataQueryCommand = Command.make(
  "query",
  {
    domain: Flag.string("domain").pipe(
      Flag.withDescription("Socrata domain without protocol, such as data.cityofnewyork.us.")
    ),
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("Socrata dataset id, such as ycrg-ses3.")
    ),
    select: Flag.string("select").pipe(
      Flag.withDescription("SoQL select expression or full SELECT query.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleSocrataQuery
).pipe(Command.withShortDescription("Run a SODA3 query."))

const socrataExportCommand = Command.make(
  "export",
  {
    domain: Flag.string("domain").pipe(
      Flag.withDescription("Socrata domain without protocol, such as data.cityofnewyork.us.")
    ),
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("Socrata dataset id, such as ycrg-ses3.")
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
  handleSocrataExport
).pipe(Command.withShortDescription("Export a SODA3 dataset."))

const socrataRangeProbeCommand = Command.make(
  "range-probe",
  {
    domain: Flag.string("domain").pipe(
      Flag.withDescription("Socrata domain without protocol, such as data.cityofnewyork.us.")
    ),
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("Socrata dataset id, such as ycrg-ses3.")
    ),
    format: Flag.choice("format", ["csv", "json", "geojson"]).pipe(
      Flag.withDefault("csv"),
      Flag.withDescription("Export format. Defaults to csv.")
    ),
    rangeEnd: Flag.integer("range-end").pipe(
      Flag.withDescription("Inclusive byte offset for a bytes=0-N range probe.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleSocrataRangeProbe
).pipe(Command.withShortDescription("Probe SODA3 export range support."))

export const socrataCommand = Command.make("socrata").pipe(
  Command.withShortDescription("Socrata SODA3 commands."),
  Command.withSubcommands([socrataQueryCommand, socrataExportCommand, socrataRangeProbeCommand])
)
