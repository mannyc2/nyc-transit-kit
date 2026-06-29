import {
  MtaJsonDirectFetchRequest,
  type MtaJsonDirectFetchRequestInput,
  MtaJsonDirectFetchResult
} from "@nyc-transit-kit/contracts/mta"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { MtaHttpError, MtaInvalidInputError } from "./errors"

export type { MtaJsonDirectFetchRequestInput }

const jsonDirectOperation = "json-direct"
const defaultApiKeyParameterName = "key"

const decodeJsonDirectFetchRequest = (input: unknown) =>
  Schema.decodeUnknownEffect(MtaJsonDirectFetchRequest)(input).pipe(
    Effect.catchTag("SchemaError", (error) =>
      Effect.fail(
        MtaInvalidInputError.make({
          operation: jsonDirectOperation,
          message: error.message
        })
      )
    )
  )

const httpStatusText = (status: number) => `HTTP ${status}`
const isOkStatus = (status: number) => status >= 200 && status < 300

const mapMtaHttpClientError = (operation: string, error: HttpClientError.HttpClientError) => {
  const response = error.response

  if (response !== undefined) {
    return MtaHttpError.make({
      operation,
      status: response.status,
      statusText: httpStatusText(response.status)
    })
  }

  return MtaHttpError.make({
    operation,
    status: 0,
    statusText: error.message
  })
}

const shouldRedactSearchParameter = (name: string) => {
  const lower = name.toLowerCase()
  return lower.includes("key") || lower.includes("token") || lower.includes("secret")
}

export const redactMtaJsonDirectUrl = (url: string) => {
  try {
    const parsed = new URL(url)

    for (const name of parsed.searchParams.keys()) {
      if (shouldRedactSearchParameter(name)) {
        parsed.searchParams.set(name, "REDACTED")
      }
    }

    return parsed.toString()
  } catch {
    return "[invalid-url]"
  }
}

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
  const response = yield* HttpClient.execute(
    HttpClientRequest.get(url, {
      acceptJson: true
    })
  ).pipe(Effect.mapError((error) => mapMtaHttpClientError(jsonDirectOperation, error)))

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

  return MtaJsonDirectFetchResult.make({
    surface: request.surface,
    status: response.status,
    url: redactMtaJsonDirectUrl(url.toString()),
    contentType: response.headers["content-type"],
    json
  })
})
