/**
 * Curated datasets: a Socrata dataset together with the schema of one full row,
 * queried and decoded as typed rows.
 */
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import type { DatasetRef } from "./Socrata"
import * as Soda3Client from "./Soda3Client"
import * as Soql from "./Soql"

/** A Socrata dataset and the schema of one full row. */
export interface Dataset<
  Row extends Schema.Codec<unknown, unknown> = Schema.Codec<unknown, unknown>
> extends DatasetRef {
  readonly title: string
  readonly description: string
  readonly row: Row
  /** The column that orders rows in time, when there is one. */
  readonly timestampColumn?: string
}

/**
 * Typed rows. A row schema describes whole rows, so typed queries always
 * `SELECT *`; use `Soda3Client` for projections and aggregates.
 */
export const query = Effect.fn("Dataset.query")(function* <
  Row extends Schema.Codec<unknown, unknown>
>(dataset: Dataset<Row>, clauses: Soql.Clauses = {}) {
  const soda = yield* Soda3Client.Soda3Client
  const rows = yield* soda.query({
    domain: dataset.domain,
    datasetId: dataset.datasetId,
    query: Soql.selectAll(clauses)
  })
  return yield* Schema.decodeUnknownEffect(Schema.Array(dataset.row))(rows)
})

/**
 * Every matching row, one page per request, decoded as it arrives. When the
 * dataset changes while you page, order by its `timestampColumn`; see
 * `Soda3Client.streamRows`.
 */
export const stream = <Row extends Schema.Codec<unknown, unknown>>(
  dataset: Dataset<Row>,
  clauses: Omit<Soql.Clauses, "limit"> = {},
  pageSize?: number
) =>
  Soda3Client.streamRows(
    { domain: dataset.domain, datasetId: dataset.datasetId, query: Soql.selectAll(clauses) },
    pageSize
  ).pipe(Stream.mapEffect((row) => Schema.decodeUnknownEffect(dataset.row)(row)))

/** The dataset's SODA3 export, as bytes. */
export const exportBytes = (
  dataset: DatasetRef,
  format: Soda3Client.ExportFormat,
  body: Omit<Soda3Client.ExportRequest, "domain" | "datasetId" | "format"> = {}
) =>
  Stream.service(Soda3Client.Soda3Client).pipe(
    Stream.flatMap((soda) =>
      soda.export({ ...body, domain: dataset.domain, datasetId: dataset.datasetId, format })
    )
  )
