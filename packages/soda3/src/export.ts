import type { Soda3ExportRequestInput } from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { Soda3ClientConfig } from "./client"
import { buildExportUrl, decodeSoda3ExportRequest } from "./endpoints"
import { InvalidInputError } from "./errors"
import {
  addHeaders,
  executeRequest,
  rangeHeader,
  requestWithPolicy,
  toExportBody,
  toWebResponse
} from "./internal/transport"

export type { Soda3ExportRequestInput }

export const exportResponse = Effect.fn("Soda3.exportResponse")(function* (
  input: Soda3ExportRequestInput
) {
  const config = yield* Soda3ClientConfig
  const exportRequest = yield* decodeSoda3ExportRequest(input)
  const url = yield* buildExportUrl(exportRequest)
  const headers = addHeaders(config)
  const range = rangeHeader(exportRequest)

  const request = yield* HttpClientRequest.post(url, {
    headers: {
      ...headers,
      range
    }
  }).pipe(
    HttpClientRequest.bodyJson(toExportBody(exportRequest)),
    Effect.mapError(() =>
      InvalidInputError.make({
        operation: "export",
        message: "SODA3 export body was not JSON serializable"
      })
    )
  )

  return yield* requestWithPolicy(
    "export",
    executeRequest("export", request).pipe(Effect.flatMap(toWebResponse))
  )
})
