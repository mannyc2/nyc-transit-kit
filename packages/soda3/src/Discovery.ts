/**
 * The Socrata Discovery API: catalog search and dataset metadata. It needs no
 * app token.
 */
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Schema from "effect/Schema"
import { type DatasetRef, filterStatusOk, SocrataDatasetId, SocrataDomain } from "./Socrata"

export const url = "https://api.us.socrata.com/api/catalog/v1"

const Resource = Schema.Struct({
  id: SocrataDatasetId,
  name: Schema.String,
  description: Schema.String,
  type: Schema.String,
  attribution: Schema.NullOr(Schema.String),
  updatedAt: Schema.String,
  createdAt: Schema.String,
  data_updated_at: Schema.String,
  metadata_updated_at: Schema.String,
  columns_name: Schema.Array(Schema.String),
  columns_field_name: Schema.Array(Schema.String),
  columns_datatype: Schema.Array(Schema.String),
  columns_description: Schema.Array(Schema.String)
})

export const CatalogResult = Schema.Struct({
  resource: Resource,
  classification: Schema.Struct({
    categories: Schema.Array(Schema.String),
    tags: Schema.Array(Schema.String),
    domain_category: Schema.optionalKey(Schema.String),
    domain_tags: Schema.Array(Schema.String)
  }),
  metadata: Schema.Struct({ domain: SocrataDomain }),
  permalink: Schema.String,
  link: Schema.String
})
export type CatalogResult = typeof CatalogResult.Type

/** Response of `GET https://api.us.socrata.com/api/catalog/v1`. */
export const SearchResponse = Schema.Struct({
  results: Schema.Array(CatalogResult),
  resultSetSize: Schema.Int
})
export type SearchResponse = typeof SearchResponse.Type

export class DatasetNotFound extends Schema.TaggedError<DatasetNotFound>()("DatasetNotFound", {
  domain: SocrataDomain,
  datasetId: SocrataDatasetId
}) {
  override get message() {
    return `${this.domain} has no public dataset ${this.datasetId}`
  }
}

export interface Search {
  readonly domain: SocrataDomain
  readonly query?: string | undefined
  readonly ids?: ReadonlyArray<SocrataDatasetId> | undefined
  readonly categories?: ReadonlyArray<string> | undefined
  readonly tags?: ReadonlyArray<string> | undefined
  readonly order?: string | undefined
  readonly limit?: number | undefined
  readonly offset?: number | undefined
}

/** Searches the public datasets of one domain. */
export const search = Effect.fn("Discovery.search")(function* (search: Search) {
  const client = yield* HttpClient.HttpClient
  const response = yield* client
    .get(url, {
      acceptJson: true,
      urlParams: {
        domains: search.domain,
        search_context: search.domain,
        only: "dataset",
        q: search.query,
        ids: search.ids,
        categories: search.categories,
        tags: search.tags,
        order: search.order,
        limit: search.limit,
        offset: search.offset
      }
    })
    .pipe(Effect.flatMap(filterStatusOk))
  return yield* HttpClientResponse.schemaBodyJson(SearchResponse)(response)
})

/** The Discovery entry of one dataset. */
export const metadata = Effect.fn("Discovery.metadata")(function* (ref: DatasetRef) {
  const { results } = yield* search({ domain: ref.domain, ids: [ref.datasetId] })
  const result = results.find((candidate) => candidate.resource.id === ref.datasetId)
  return result ?? (yield* new DatasetNotFound({ domain: ref.domain, datasetId: ref.datasetId }))
})

/** Discovery lists columns as four parallel arrays; this zips them. */
export const columns = ({ resource }: CatalogResult) =>
  resource.columns_field_name.map((field, index) => ({
    field,
    name: resource.columns_name[index] ?? field,
    datatype: resource.columns_datatype[index] ?? "",
    description: resource.columns_description[index] ?? ""
  }))
