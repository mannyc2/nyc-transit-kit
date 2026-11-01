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
  /** The column that orders rows in time, when there is one. `stream` pages in its order. */
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

const oldestFirst = (dataset: Pick<Dataset, "timestampColumn">): Soql.OrderBy | undefined =>
  dataset.timestampColumn === undefined ? undefined : { column: dataset.timestampColumn }

/**
 * Every matching row, one page per request, decoded as it arrives. Unless
 * `clauses` give an `orderBy`, rows come oldest first by the dataset's
 * `timestampColumn`, when it has one, so rows added while you page land after
 * the pages already read. Unordered, SODA3 served Traffic Speeds newest first
 * and page 2 repeated page 1; see `Soda3Client.streamRows`.
 */
export const stream = <Row extends Schema.Codec<unknown, unknown>>(
  dataset: Dataset<Row>,
  clauses: Omit<Soql.Clauses, "limit"> = {},
  pageSize?: number
) =>
  Soda3Client.streamRows(
    {
      domain: dataset.domain,
      datasetId: dataset.datasetId,
      query: Soql.selectAll({ ...clauses, orderBy: clauses.orderBy ?? oldestFirst(dataset) })
    },
    pageSize
  ).pipe(Stream.mapEffect((row) => Schema.decodeUnknownEffect(dataset.row)(row)))

/** The dataset's SODA3 export as CSV bytes, narrowed by `body.query` when given. */
export const exportBytes = (
  dataset: DatasetRef,
  body: Omit<Soda3Client.ExportRequest, "domain" | "datasetId"> = {}
) =>
  Stream.service(Soda3Client.Soda3Client).pipe(
    Stream.flatMap((soda) =>
      soda.export({ ...body, domain: dataset.domain, datasetId: dataset.datasetId })
    )
  )
