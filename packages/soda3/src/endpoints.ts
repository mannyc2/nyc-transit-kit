import {
  Soda3CatalogSearchRequest,
  type Soda3CatalogSearchRequestInput,
  Soda3ExportRequest,
  type Soda3ExportRequestInput,
  Soda3QueryRequest,
  type Soda3QueryRequestInput
} from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { InvalidInputError } from "./errors"

export const socrataApiVersion = "v3"
export const defaultSocrataProtocol = "https"
export const discoveryApiHost = "api.us.socrata.com"

const decodeQueryRequest = (input: unknown) =>
  Schema.decodeUnknownEffect(Soda3QueryRequest)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        InvalidInputError.make({
          operation: "query",
          message: error.message
        })
      )
    )
  )

const decodeExportRequest = (input: unknown) =>
  Schema.decodeUnknownEffect(Soda3ExportRequest)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        InvalidInputError.make({
          operation: "export",
          message: error.message
        })
      )
    )
  )

const decodeCatalogSearchRequest = (input: unknown) =>
  Schema.decodeUnknownEffect(Soda3CatalogSearchRequest)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        InvalidInputError.make({
          operation: "catalog",
          message: error.message
        })
      )
    )
  )

const viewUrl = (domain: string, datasetId: string, suffix: string) => {
  const url = new URL(`${defaultSocrataProtocol}://${domain}`)
  url.pathname = `/api/${socrataApiVersion}/views/${datasetId}/${suffix}`
  return url
}

export const buildQueryUrl = Effect.fn("Soda3.buildQueryUrl")(function* (
  input: Soda3QueryRequestInput
) {
  const request = yield* decodeQueryRequest(input)
  return viewUrl(request.domain, request.datasetId, "query.json")
})

export const buildExportUrl = Effect.fn("Soda3.buildExportUrl")(function* (
  input: Soda3ExportRequestInput
) {
  const request = yield* decodeExportRequest(input)
  return viewUrl(request.domain, request.datasetId, `export.${request.format}`)
})

export const buildCatalogSearchUrl = Effect.fn("Soda3.buildCatalogSearchUrl")(function* (
  input: Soda3CatalogSearchRequestInput
) {
  const request = yield* decodeCatalogSearchRequest(input)
  const url = new URL(`${defaultSocrataProtocol}://${discoveryApiHost}`)
  url.pathname = "/api/catalog/v1"
  url.searchParams.set("domains", request.domain)
  url.searchParams.set("search_context", request.domain)
  url.searchParams.set("only", "dataset")

  if (request.query !== undefined) {
    url.searchParams.set("search", request.query)
  }
  if (request.limit !== undefined) {
    url.searchParams.set("limit", request.limit.toString())
  }
  if (request.offset !== undefined) {
    url.searchParams.set("offset", request.offset.toString())
  }

  return url
})

export const decodeSoda3QueryRequest = decodeQueryRequest
export const decodeSoda3ExportRequest = decodeExportRequest
export const decodeSoda3CatalogSearchRequest = decodeCatalogSearchRequest
