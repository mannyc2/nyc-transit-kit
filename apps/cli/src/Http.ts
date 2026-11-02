/**
 * The HttpClient every command runs with: the caller's client with the CLI's
 * retry policy, or, with `--dry-run`, one that records requests and sends none.
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientError from "effect/http/HttpClientError"
import type * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schedule from "effect/Schedule"
import * as Schema from "effect/Schema"

// Socrata and the MTA collect no traces, so requests go without b3 and traceparent headers.
const untraced = Layer.succeed(HttpClient.TracerPropagationEnabled, false)

/**
 * The provided HttpClient, retried twice on transient failures (network, 408,
 * 429, 5xx) with exponential backoff that waits at least as long as
 * `Retry-After` asks. The libraries never retry on their own.
 */
export const live = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(
    HttpClient.HttpClient,
    HttpClient.retryTransient({ schedule: Schedule.exponential("250 millis"), times: 2 })
  )
).pipe(Layer.merge(untraced))

export interface RecordedRequest {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, unknown>>
  readonly body?: unknown
}

export class DryRun extends Context.Service<DryRun, Ref.Ref<ReadonlyArray<RecordedRequest>>>()(
  "@nyc-transit-kit/cli/DryRun"
) {}

const decodeJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))

const record = (request: HttpClientRequest.HttpClientRequest, url: URL): RecordedRequest => {
  const headers = Headers.redact(request.headers, "x-app-token")
  if (request.body._tag !== "Uint8Array") {
    return { method: request.method, url: url.toString(), headers }
  }
  const text = new TextDecoder().decode(request.body.body)
  return {
    method: request.method,
    url: url.toString(),
    headers,
    body: Option.getOrElse(decodeJson(text), () => text)
  }
}

/** `--dry-run`: records each request into `DryRun` and fails it, so nothing is sent. */
export const dryRun = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(DryRun, (recorded) =>
    HttpClient.make((request, url) =>
      Ref.update(recorded, (requests) => [...requests, record(request, url)]).pipe(
        Effect.andThen(
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({ request, description: "--dry-run" })
            })
          )
        )
      )
    )
  )
).pipe(Layer.merge(untraced))
