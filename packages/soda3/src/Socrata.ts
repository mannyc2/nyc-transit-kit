/**
 * What every Socrata API shares: domains, dataset ids, the floating timestamps
 * in rows, and the error Socrata answers with.
 */
import * as Effect from "effect/Effect"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

/** A Socrata domain without protocol or path, such as `data.cityofnewyork.us`. */
export const SocrataDomain = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/, {
      message: "Expected a Socrata domain without a protocol or path"
    })
  ),
  Schema.brand("SocrataDomain")
)
export type SocrataDomain = typeof SocrataDomain.Type

/** The eight-character id of a dataset, such as `i4gi-tjb9`. */
export const SocrataDatasetId = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[a-z0-9]{4}-[a-z0-9]{4}$/, {
      message: "Expected an eight-character Socrata dataset id such as abcd-1234"
    })
  ),
  Schema.brand("SocrataDatasetId")
)
export type SocrataDatasetId = typeof SocrataDatasetId.Type

/** One dataset on one domain. */
export interface DatasetRef {
  readonly domain: SocrataDomain
  readonly datasetId: SocrataDatasetId
}

/** The dataset's page, `https://{domain}/d/{id}`. */
export const datasetUrl = (ref: DatasetRef) => `https://${ref.domain}/d/${ref.datasetId}`

const isCalendarDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) {
    return false
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/** A calendar date, `YYYY-MM-DD`. */
export const IsoDate = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter<string>(
      (value) => isCalendarDate(value) || "Expected an ISO calendar date in YYYY-MM-DD format"
    )
  ),
  Schema.brand("IsoDate")
)
export type IsoDate = typeof IsoDate.Type

/** Floating timestamps carry no zone: `2026-10-26T23:02:06.000` is New York local time. */
export const FloatingTimestamp = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/, {
    message: "Expected a Socrata floating timestamp such as 2026-10-26T23:02:06.000"
  })
)

export const MultiLineString = Schema.Struct({
  type: Schema.Literal("MultiLineString"),
  coordinates: Schema.Array(Schema.Array(Schema.Array(Schema.Finite)))
})

/** Socrata answered with a non-2xx status. `message` is Socrata's own sentence when it sent one. */
export class SocrataError extends Schema.TaggedError<SocrataError>()("SocrataError", {
  status: Schema.Int,
  code: Schema.optional(Schema.String),
  message: Schema.String
}) {}

/** Non-2xx bodies: SODA3 sends `{ code, error: true, message }`, Discovery sends `{ error }`. */
export const SocrataErrorBody = Schema.Union([
  Schema.Struct({ code: Schema.optionalKey(Schema.String), message: Schema.String }),
  Schema.Struct({ error: Schema.String })
])

const decodeErrorBody = Schema.decodeUnknownOption(Schema.fromJsonString(SocrataErrorBody))

const socrataError = (status: number, text: string) =>
  Option.match(decodeErrorBody(text), {
    onNone: () => new SocrataError({ status, message: `Socrata answered HTTP ${status}` }),
    onSome: (body) =>
      "message" in body
        ? new SocrataError({ status, code: body.code, message: body.message })
        : new SocrataError({ status, message: body.error })
  })

/**
 * Passes 2xx responses through and fails the rest with a `SocrataError`. Unlike
 * `HttpClient.filterStatusOk` it reads the body, which holds the only useful
 * sentence, such as "This request must be authenticated or have an application token".
 */
export const filterStatusOk = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<HttpClientResponse.HttpClientResponse, SocrataError> =>
  HttpClientResponse.matchStatus(response, {
    "2xx": (ok) => Effect.succeed(ok),
    orElse: (failed) =>
      failed.text.pipe(
        Effect.orElseSucceed(() => ""),
        Effect.flatMap((text) => Effect.fail(socrataError(failed.status, text)))
      )
  })
