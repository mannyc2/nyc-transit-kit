import {
  MtaElevatorEscalatorCurrent,
  MtaJsonDirectFetchRequest,
  type MtaJsonDirectFetchRequestInput,
  MtaJsonDirectFetchResult
} from "@nyc-transit-kit/contracts/mta"
import { httpStatusText, isOkStatus, redactedUrl } from "@nyc-transit-kit/soda3/transport"
import * as Effect from "effect/Effect"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { MtaHttpError, MtaInvalidInputError } from "./errors"
import {
  decodeMtaInput,
  executeMtaRequest,
  requestWithPolicy,
  retryableStatusError
} from "./internal/decode"

export type { MtaJsonDirectFetchRequestInput }

const jsonDirectOperation = "json-direct"
const defaultApiKeyParameterName = "key"
const decodeJsonDirectFetchRequest = decodeMtaInput(jsonDirectOperation, MtaJsonDirectFetchRequest)
export const decodeMtaElevatorEscalatorCurrent = decodeMtaInput(
  "elevator-escalator-current",
  MtaElevatorEscalatorCurrent
)
export const redactMtaJsonDirectUrl = redactedUrl
const jsonDirectUrl = (request: MtaJsonDirectFetchRequest) =>
  Effect.try({
    try: () => {
      const parsed = new URL(request.url)
      if (request.query !== undefined) {
        for (const [name, value] of Object.entries(request.query)) {
          parsed.searchParams.set(name, value)
        }
      }
      if (request.apiKey !== undefined) {
        parsed.searchParams.set(
          request.apiKeyParameterName ?? defaultApiKeyParameterName,
          request.apiKey
        )
      }
      return parsed
    },
    catch: () =>
      MtaInvalidInputError.make({
        operation: jsonDirectOperation,
        message: "MTA JSON direct request URL must be absolute and valid"
      })
  })
export const fetchMtaJsonDirect = Effect.fn("Mta.fetchMtaJsonDirect")(function* (
  input: MtaJsonDirectFetchRequestInput
) {
  const request = yield* decodeJsonDirectFetchRequest(input)
  const url = yield* jsonDirectUrl(request)
  const response = yield* requestWithPolicy(
    jsonDirectOperation,
    executeMtaRequest(
      jsonDirectOperation,
      HttpClientRequest.get(url, {
        acceptJson: true
      })
    ),
    {
      retryableResult: (response) => retryableStatusError(jsonDirectOperation, response.status)
    }
  )
  if (!isOkStatus(response.status)) {
    return yield* MtaHttpError.make({
      operation: jsonDirectOperation,
      status: response.status,
      statusText: httpStatusText(response.status)
    })
  }
  const json = yield* response.json.pipe(
    Effect.mapError(() =>
      MtaHttpError.make({
        operation: jsonDirectOperation,
        status: response.status,
        statusText: "Provider response was not valid JSON"
      })
    )
  )
  const contentType = response.headers["content-type"]
  return MtaJsonDirectFetchResult.make({
    surface: request.surface,
    status: response.status,
    url: redactMtaJsonDirectUrl(url.toString()),
    json,
    ...(contentType === undefined ? {} : { contentType })
  })
})
