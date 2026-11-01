/**
 * SODA3 `query.json` and `export.{format}` on any Socrata domain.
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import type * as HttpClientError from "effect/http/HttpClientError"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"
import { type DatasetRef, filterStatusOk, type SocrataError } from "./Socrata"
import * as Soql from "./Soql"

/**
 * The export formats Socrata names. On 2026-11-01 SODA3 refused `json` and
 * `geojson` with a 406 on every dataset tried; `csv` worked.
 */
export const ExportFormat = Schema.Literals(["csv", "json", "geojson"])
export type ExportFormat = typeof ExportFormat.Type

export const OrderingSpecifier = Schema.Literals(["total", "discard"])
export type OrderingSpecifier = typeof OrderingSpecifier.Type

export const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0))

export const Page = Schema.Struct({ pageNumber: PositiveInt, pageSize: PositiveInt })
export type Page = typeof Page.Type

/** Only parameterized views read `parameters`; ordinary queries carry their values in the SoQL. */
export const Parameters = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
)

/** Body of `POST /api/v3/views/{id}/query.json`. */
export const QueryBody = Schema.Struct({
  query: Schema.String,
  page: Schema.optionalKey(Page),
  parameters: Schema.optionalKey(Parameters),
  timeout: Schema.optionalKey(PositiveInt),
  includeSystem: Schema.optionalKey(Schema.Boolean),
  includeSynthetic: Schema.optionalKey(Schema.Boolean),
  orderingSpecifier: Schema.optionalKey(OrderingSpecifier)
})
export type QueryBody = typeof QueryBody.Type

/** Body of `POST /api/v3/views/{id}/export.{format}`. */
export const ExportBody = Schema.Struct({
  query: Schema.optionalKey(Schema.String),
  parameters: Schema.optionalKey(Parameters),
  timeout: Schema.optionalKey(PositiveInt),
  orderingSpecifier: Schema.optionalKey(OrderingSpecifier),
  serializationOptions: Schema.optionalKey(Schema.Record(Schema.String, Schema.String))
})
export type ExportBody = typeof ExportBody.Type

export const Row = Schema.Record(Schema.String, Schema.Unknown)
export type Row = typeof Row.Type

/**
 * A bare array of rows. Numbers arrive as text, null cells are left out, and
 * unless `includeSystem` or `includeSynthetic` is false each row ends with the
 * system columns `:id`, `:version`, `:created_at` and `:updated_at`.
 */
export const QueryResponse = Schema.Array(Row)

/** A query: the body with SoQL as text or as a fragment. */
export interface QueryRequest extends DatasetRef, Omit<QueryBody, "query"> {
  readonly query: string | Soql.Fragment
}

export interface ExportRequest extends DatasetRef, Omit<ExportBody, "query"> {
  readonly format: ExportFormat
  readonly query?: string | Soql.Fragment
  /**
   * Ask for a byte range. On 2026-11-01 SODA3 ignored it and sent the whole
   * export with a 200; `ntk socrata range-probe` checks again.
   */
  readonly range?: { readonly start: number; readonly end?: number }
}

export type QueryError =
  | HttpClientError.HttpClientError
  | SocrataError
  | Soql.SoqlError
  | Schema.SchemaError

export type ExportError = HttpClientError.HttpClientError | SocrataError | Soql.SoqlError

export const viewUrl = (ref: DatasetRef, file: string) =>
  `https://${ref.domain}/api/v3/views/${ref.datasetId}/${file}`

/**
 * SODA3 query and export. Socrata refuses both without an app token, so the
 * layer requires one. Retries and timeouts belong to the caller's HttpClient.
 * SODA3 has no default limit: a query without `LIMIT` or `page` returns every
 * matching row.
 */
export class Soda3Client extends Context.Service<
  Soda3Client,
  {
    readonly query: (request: QueryRequest) => Effect.Effect<ReadonlyArray<Row>, QueryError>
    readonly export: (request: ExportRequest) => Stream.Stream<Uint8Array, ExportError>
  }
>()("@nyc-transit-kit/soda3/Soda3Client") {}

const soqlText = (query: string | Soql.Fragment) =>
  typeof query === "string" ? Effect.succeed(query) : Soql.compile(query)

// Only these fields reach the body, so a request built by spreading a richer
// object, such as a curated `Dataset`, sends nothing else.
const queryOptions = [
  "page",
  "parameters",
  "timeout",
  "includeSystem",
  "includeSynthetic",
  "orderingSpecifier"
] as const
const exportOptions = [
  "parameters",
  "timeout",
  "orderingSpecifier",
  "serializationOptions"
] as const

const exportBody = Effect.fnUntraced(function* (request: ExportRequest) {
  const body = Struct.pick(request, exportOptions)
  return request.query === undefined ? body : { ...body, query: yield* soqlText(request.query) }
})

export const layer = (options: { readonly appToken: Redacted.Redacted }) =>
  Layer.effect(
    Soda3Client,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest(
          HttpClientRequest.setHeader("x-app-token", Redacted.value(options.appToken))
        ),
        HttpClient.transformResponse(Effect.flatMap(filterStatusOk))
      )
      const post = (url: string, body: object, headers: Readonly<Record<string, string>> = {}) =>
        client.execute(
          HttpClientRequest.post(url, { headers }).pipe(HttpClientRequest.bodyJsonUnsafe(body))
        )

      const query = Effect.fn("Soda3Client.query")(function* (request: QueryRequest) {
        const response = yield* post(
          viewUrl(request, "query.json"),
          { ...Struct.pick(request, queryOptions), query: yield* soqlText(request.query) },
          { accept: "application/json" }
        )
        return yield* HttpClientResponse.schemaBodyJson(QueryResponse)(response)
      })

      const exportBytes = (request: ExportRequest) =>
        Stream.unwrap(
          Effect.map(exportBody(request), (body) =>
            HttpClientResponse.stream(
              post(
                viewUrl(request, `export.${request.format}`),
                body,
                request.range === undefined
                  ? {}
                  : { range: `bytes=${request.range.start}-${request.range.end ?? ""}` }
              )
            )
          )
        ).pipe(Stream.withSpan("Soda3Client.export"))

      return Soda3Client.of({ query, export: exportBytes })
    })
  )

/**
 * Every row of a query, one page per request. Pages end at the first short page.
 *
 * A page is a slice of the query's order, so order by something that puts new
 * rows last, such as the dataset's timestamp column, when the dataset changes
 * while you page. Without an `ORDER BY`, SODA3 served Traffic Speeds newest
 * first, requests seconds apart disagreed on the newest rows, and page 2
 * repeated page 1. SODA3 refuses paging with `orderingSpecifier: "discard"`,
 * so this takes none.
 */
export const streamRows = (
  request: Omit<QueryRequest, "page" | "orderingSpecifier">,
  pageSize = 1000
) =>
  Stream.paginate(1, (pageNumber: number) =>
    Effect.gen(function* () {
      const soda = yield* Soda3Client
      const rows = yield* soda.query({ ...request, page: { pageNumber, pageSize } })
      const next = rows.length < pageSize ? Option.none<number>() : Option.some(pageNumber + 1)
      return [rows, next] as const
    })
  )

// SODA3 sends `count(*)` as text, like every number in a row.
const CountRows = Schema.Tuple([Schema.Struct({ count: Schema.FiniteFromString })])

/** `count(*)` of the rows that match `where`, or of all rows. */
export const countRows = Effect.fn("Soda3Client.countRows")(function* (
  ref: DatasetRef,
  where?: Soql.Fragment
) {
  const soda = yield* Soda3Client
  const rows = yield* soda.query({
    ...ref,
    query:
      where === undefined
        ? Soql.soql`SELECT count(*) AS count`
        : Soql.soql`SELECT count(*) AS count WHERE ${where}`,
    includeSynthetic: false
  })
  const [row] = yield* Schema.decodeUnknownEffect(CountRows)(rows)
  return row.count
})
