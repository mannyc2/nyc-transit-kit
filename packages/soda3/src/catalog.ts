import type { Soda3CatalogSearchRequestInput } from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { buildCatalogSearchUrl } from "./endpoints"
import { decodeCatalogSearchResponse, decodeJson } from "./internal/responses"
import { Soda3ClientConfig } from "./internal/services"
import { addHeaders, executeRequest, requestWithPolicy } from "./internal/transport"

export { buildCatalogSearchUrl } from "./endpoints"
export type { Soda3CatalogSearchRequestInput }

export const catalogSearch = Effect.fn("Soda3.catalogSearch")(function* (
  input: Soda3CatalogSearchRequestInput
) {
  const config = yield* Soda3ClientConfig
  const url = yield* buildCatalogSearchUrl(input)
  const request = HttpClientRequest.get(url, {
    headers: addHeaders(config)
  })

  return yield* requestWithPolicy(
    "catalog",
    executeRequest("catalog", request).pipe(
      Effect.flatMap((response) => decodeJson("catalog", response)),
      Effect.flatMap(decodeCatalogSearchResponse)
    )
  )
})
