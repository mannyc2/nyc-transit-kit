import type { Dataset } from "@nyc-transit-kit/soda3/Dataset"
import * as Discovery from "@nyc-transit-kit/soda3/Discovery"
import {
  type DatasetRef,
  datasetUrl,
  SocrataDatasetId,
  SocrataDomain
} from "@nyc-transit-kit/soda3/Socrata"
import * as Soda3Client from "@nyc-transit-kit/soda3/Soda3Client"
import * as Config from "effect/Config"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Record from "effect/Record"
import type { ApiFamily } from "../Envelope"
import { writeFiles } from "../Files"
import * as Output from "../Output"

export const domainFlag = Flag.String("domain").pipe(
  Flag.withSchema(SocrataDomain),
  Flag.withDescription("Socrata domain, such as data.cityofnewyork.us.")
)

export const datasetIdFlag = Flag.String("dataset").pipe(
  Flag.withSchema(SocrataDatasetId),
  Flag.withDescription("Socrata dataset id, such as ycrg-ses3.")
)

// Required: SODA3 has no default limit, so a bare `SELECT *` sends back every row.
export const selectFlag = Flag.String("select").pipe(
  Flag.withDescription(
    'A SoQL query, or just the part after SELECT, such as "speed, link_id LIMIT 5". SODA3 returns every matching row unless the query has a LIMIT.'
  )
)

// SODA3 refused json and geojson exports with a 406, so csv is the only
// choice. The flag stays so that 0.2 scripts passing `--format csv` still run.
export const formatFlag = Flag.Literals("format", ["csv"]).pipe(
  Flag.withDescription("Export format: csv, the default and the only one SODA3 exports."),
  Flag.withDefault("csv")
)

export const outputFlag = (description: string) =>
  Flag.String("output").pipe(Flag.withDescription(description))

export const appTokenFlag = Flag.Redacted("app-token").pipe(
  Flag.withFallbackConfig(Config.Redacted("SOCRATA_APP_TOKEN")),
  Flag.withDescription(
    "Socrata app token; defaults to SOCRATA_APP_TOKEN. SODA3 rejects query and export without one."
  )
)

export const searchQueryFlag = Flag.String("query").pipe(Flag.withDescription("Search text."))

export const searchLimitFlag = Flag.Int("limit").pipe(
  Flag.withDescription("Most results to return."),
  Flag.optional
)

export const soqlFromSelect = (select: string) =>
  /^\s*select\s/i.test(select) ? select : `SELECT ${select}`

export const queryRows = (apiFamily: ApiFamily, ref: DatasetRef, select: string) =>
  Effect.gen(function* () {
    const soda = yield* Soda3Client.Soda3Client
    const rows = yield* soda.query({ ...ref, query: soqlFromSelect(select) })
    yield* Output.success(apiFamily, { rows })
  })

export const exportRows = (apiFamily: ApiFamily, ref: DatasetRef, output: string) =>
  Effect.gen(function* () {
    const soda = yield* Soda3Client.Soda3Client
    const [file] = yield* writeFiles([{ path: output, content: soda.export(ref) }])
    yield* Output.success(apiFamily, file)
  })

export const searchCatalog = (
  apiFamily: ApiFamily,
  search: {
    readonly domain: SocrataDomain
    readonly query: string
    readonly limit: Option.Option<number>
  }
) =>
  Discovery.search({ ...search, limit: Option.getOrUndefined(search.limit) }).pipe(
    Effect.flatMap((response) => Output.success(apiFamily, response))
  )

const describeDataset = (name: string, dataset: Dataset) => ({
  name,
  id: dataset.datasetId,
  domain: dataset.domain,
  title: dataset.title,
  description: dataset.description,
  url: datasetUrl(dataset),
  ...(dataset.timestampColumn === undefined ? {} : { timestampColumn: dataset.timestampColumn })
})

export const datasetInfo = (apiFamily: ApiFamily, ref: DatasetRef) =>
  Effect.gen(function* () {
    const result = yield* Discovery.metadata(ref)
    const { resource } = result
    yield* Output.success(apiFamily, {
      id: resource.id,
      domain: result.metadata.domain,
      name: resource.name,
      description: resource.description,
      attribution: resource.attribution,
      updatedAt: resource.updatedAt,
      dataUpdatedAt: resource.data_updated_at,
      permalink: result.permalink,
      columns: Discovery.columns(result)
    })
  })

/**
 * `list`, `info`, `query` and `export` for one family of datasets. `select`
 * turns the family's dataset flag into a dataset reference: a curated name for
 * NYC DOT, any dataset id on the family's domain for the Open Data portals.
 */
export const datasetCommands = (options: {
  readonly apiFamily: ApiFamily
  readonly label: string
  readonly datasets: Readonly<Record<string, Dataset>>
  readonly select: Flag.Flag<DatasetRef>
}) => {
  const { apiFamily, label, datasets, select } = options
  return [
    Command.make("list", {}, () =>
      Output.success(apiFamily, { datasets: Record.collect(datasets, describeDataset) })
    ).pipe(Command.withShortDescription(`List curated ${label} datasets.`)),
    Command.make("info", { ref: select }, ({ ref }) => datasetInfo(apiFamily, ref)).pipe(
      Command.withShortDescription(`Show a ${label} dataset's metadata and columns.`)
    ),
    Command.make("query", { ref: select, select: selectFlag, appToken: appTokenFlag }, (config) =>
      queryRows(apiFamily, config.ref, config.select).pipe(
        Effect.provide(Soda3Client.layer({ appToken: config.appToken }))
      )
    ).pipe(Command.withShortDescription(`Run a SoQL query against a ${label} dataset.`)),
    Command.make(
      "export",
      {
        ref: select,
        format: formatFlag,
        output: outputFlag("File to write the export to."),
        appToken: appTokenFlag
      },
      (config) =>
        exportRows(apiFamily, config.ref, config.output).pipe(
          Effect.provide(Soda3Client.layer({ appToken: config.appToken }))
        )
    ).pipe(Command.withShortDescription(`Export a ${label} dataset to a file.`))
  ]
}
