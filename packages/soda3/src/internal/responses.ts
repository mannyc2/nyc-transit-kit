import {
  Soda3CatalogSearchResponse,
  Soda3QueryResponse,
  Soda3Row
} from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { ProviderContractError } from "../errors"

const providerRows = Schema.Array(Soda3Row)

export const decodeJson = (operation: string, response: HttpClientResponse.HttpClientResponse) =>
  response.json.pipe(
    Effect.catchTag("HttpClientError", () =>
      Effect.fail(
        ProviderContractError.make({
          operation,
          message: "Provider response was not valid JSON"
        })
      )
    )
  )

export const decodeQueryResponse = (input: unknown) =>
  Schema.decodeUnknownEffect(Soda3QueryResponse)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Schema.decodeUnknownEffect(providerRows)(input).pipe(
        Effect.map((rows) =>
          Soda3QueryResponse.make({
            rows
          })
        ),
        Effect.catchTag("SchemaError", () =>
          Effect.fail(
            ProviderContractError.make({
              operation: "query",
              message: error.message
            })
          )
        )
      )
    )
  )

export const decodeCatalogSearchResponse = (input: unknown) =>
  Schema.decodeUnknownEffect(Soda3CatalogSearchResponse)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        ProviderContractError.make({
          operation: "catalog",
          message: error.message
        })
      )
    )
  )
