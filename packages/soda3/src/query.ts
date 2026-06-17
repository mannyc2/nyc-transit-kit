import type { Soda3QueryRequestInput } from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { buildQueryUrl, decodeSoda3QueryRequest } from "./endpoints"
import { InvalidInputError } from "./errors"
import { toQueryBody } from "./internal/bodies"
import { decodeJson, decodeQueryResponse } from "./internal/responses"
import { Soda3ClientConfig } from "./internal/services"
import { addHeaders, executeRequest, requestWithPolicy } from "./internal/transport"

export type { Soda3QueryRequestInput }

export const queryRows = Effect.fn("Soda3.queryRows")(function* (input: Soda3QueryRequestInput) {
  const config = yield* Soda3ClientConfig
  const queryRequest = yield* decodeSoda3QueryRequest(input)
  const url = yield* buildQueryUrl(queryRequest)
  const request = yield* HttpClientRequest.post(url, {
    headers: addHeaders(config)
  }).pipe(
    HttpClientRequest.bodyJson(toQueryBody(queryRequest)),
    Effect.mapError(() =>
      InvalidInputError.make({
        operation: "query",
        message: "SODA3 query body was not JSON serializable"
      })
    )
  )

  return yield* requestWithPolicy(
    "query",
    executeRequest("query", request).pipe(
      Effect.flatMap((response) => decodeJson("query", response)),
      Effect.flatMap(decodeQueryResponse)
    )
  )
})
