import {
  Soda3CatalogSearchResponse,
  type Soda3ExportRequest,
  type Soda3QueryRequest,
  Soda3QueryResponse,
  Soda3Row
} from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { Soda3ClientConfig, type Soda3ClientConfigShape } from "../client"
import type { Soda3ClientError } from "../errors"
import {
  isRetryableProviderError,
  ProviderContractError,
  ProviderHttpError,
  RetryExhaustedError,
  TimeoutError
} from "../errors"
import {
  httpFailureInfo,
  httpStatusText,
  isOkStatus,
  retryableStatus,
  withRequestPolicy
} from "../transport"

export { retryableStatus, toWebResponse } from "../transport"

const providerRows = Schema.Array(Soda3Row)

const decodeUnknown = <S extends Schema.Top>(schema: S, input: unknown) =>
  Schema.decodeUnknownEffect(schema)(input)

export const addHeaders = (config: Soda3ClientConfigShape) => ({
  accept: "application/json",
  ...(config.appToken !== undefined && config.appToken.length > 0
    ? { "X-App-Token": config.appToken }
    : {})
})

export const toQueryBody = (request: Soda3QueryRequest) => ({
  query: request.query,
  page: request.page,
  parameters: request.parameters,
  timeout: request.timeout,
  includeSystem: request.includeSystem,
  includeSynthetic: request.includeSynthetic,
  orderingSpecifier: request.orderingSpecifier
})

export const toExportBody = (request: Soda3ExportRequest) => ({
  query: request.query,
  parameters: request.parameters,
  timeout: request.timeout,
  serializationOptions: request.serializationOptions
})

export const rangeHeader = (request: Soda3ExportRequest) =>
  request.range === undefined
    ? undefined
    : `bytes=${request.range.start}-${request.range.end ?? ""}`

export const mapHttpClientError = (operation: string, error: HttpClientError.HttpClientError) => {
  const info = httpFailureInfo(error)

  return ProviderHttpError.make({
    operation,
    status: info.status,
    statusText: info.statusText,
    retryable: info.status === 0 || retryableStatus(info.status)
  })
}

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
  decodeUnknown(Soda3QueryResponse, input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      decodeUnknown(providerRows, input).pipe(
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
  decodeUnknown(Soda3CatalogSearchResponse, input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        ProviderContractError.make({
          operation: "catalog",
          message: error.message
        })
      )
    )
  )

export const requestWithPolicy = <A>(
  operation: string,
  effect: Effect.Effect<A, Soda3ClientError, HttpClient.HttpClient | Soda3ClientConfig>
) =>
  Effect.gen(function* () {
    const config = yield* Soda3ClientConfig
    return yield* withRequestPolicy(config, effect, {
      isRetryable: isRetryableProviderError,
      onExhausted: (attempts, error) =>
        RetryExhaustedError.make({
          operation,
          attempts,
          message: `Retry attempts exhausted after provider status ${error.status}`
        }),
      onTimeout: (timeoutMs) =>
        TimeoutError.make({
          operation,
          timeoutMs
        })
    })
  })

export const executeRequest = (operation: string, request: HttpClientRequest.HttpClientRequest) =>
  Effect.gen(function* () {
    const response = yield* HttpClient.execute(request).pipe(
      Effect.mapError((error) => mapHttpClientError(operation, error))
    )

    if (!isOkStatus(response.status)) {
      return yield* ProviderHttpError.make({
        operation,
        status: response.status,
        statusText: httpStatusText(response.status),
        retryable: retryableStatus(response.status)
      })
    }

    return response
  })
