import {
  PositiveInteger,
  type Soda3QueryRequestInput,
  type Soda3Row
} from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { buildQueryUrl, decodeSoda3QueryRequest } from "./endpoints"
import { InvalidInputError, ProviderContractError } from "./errors"
import { toQueryBody } from "./internal/bodies"
import { decodeJson, decodeQueryResponse } from "./internal/responses"
import { Soda3ClientConfig } from "./internal/services"
import { addHeaders, executeRequest, requestWithPolicy } from "./internal/transport"

export type { Soda3QueryRequestInput }

export type Soda3QueryAllRowsInput = Omit<Soda3QueryRequestInput, "page"> & {
  readonly pageSize?: number
  readonly maxRows?: number
}

export type Soda3CountRowsInput = {
  readonly domain: string
  readonly datasetId: string
  readonly where?: string
  readonly parameters?: Readonly<Record<string, unknown>>
}

const decodeHelperPositiveInteger = (name: string, value: number) =>
  Schema.decodeUnknownEffect(PositiveInteger)(value).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        InvalidInputError.make({
          operation: "query",
          message: `Invalid ${name}: ${error.message}`
        })
      )
    )
  )

const decodeOptionalHelperPositiveInteger = (name: string, value: number | undefined) =>
  value === undefined ? Effect.void : decodeHelperPositiveInteger(name, value)

const decodeCountValue = (value: unknown) => {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

const countColumnName = "count"

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

export const queryAllRows = Effect.fn("Soda3.queryAllRows")(function* (
  input: Soda3QueryAllRowsInput
) {
  const { pageSize: rawPageSize = 1000, maxRows: rawMaxRows, ...queryInput } = input
  const pageSize = yield* decodeHelperPositiveInteger("pageSize", rawPageSize)
  const maxRows = yield* decodeOptionalHelperPositiveInteger("maxRows", rawMaxRows)
  const rows: Array<Soda3Row> = []
  let pageNumber = 1

  while (true) {
    const response = yield* queryRows({
      ...queryInput,
      page: {
        pageNumber,
        pageSize
      }
    })
    rows.push(...response.rows)

    if (maxRows !== undefined && rows.length > maxRows) {
      return yield* InvalidInputError.make({
        operation: "query",
        message: `SODA3 query exceeded maxRows=${maxRows}; narrow the query or raise maxRows`
      })
    }

    if (response.rows.length < pageSize) {
      return rows
    }

    pageNumber += 1
  }
})

export const countRows = Effect.fn("Soda3.countRows")(function* (input: Soda3CountRowsInput) {
  const query = `SELECT count(*)${input.where === undefined ? "" : ` WHERE ${input.where}`}`
  const response = yield* queryRows({
    domain: input.domain,
    datasetId: input.datasetId,
    query,
    ...(input.parameters === undefined ? {} : { parameters: input.parameters }),
    includeSynthetic: false
  })
  const count = decodeCountValue(response.rows[0]?.[countColumnName])

  if (count === undefined) {
    return yield* ProviderContractError.make({
      operation: "query",
      message: "SODA3 count(*) response did not include a numeric count"
    })
  }

  return count
})
