/**
 * An `HttpClient` for tests. It answers each request with a handler and keeps a
 * copy of everything it was sent, so a test runs the real client code against
 * real samples without a network.
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import type * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import {
  soda3AuthenticationRequired,
  soda3DiscardWithPaging,
  soda3ExportTypeUnavailable
} from "./Samples"

/** A request as the client sent it. `body` is parsed JSON, or text, or undefined without one. */
export interface SentRequest {
  readonly method: HttpClientRequest.HttpClientRequest["method"]
  readonly url: URL
  readonly headers: Headers.Headers
  readonly body: unknown
}

/** What a handler answers with: a web `Response`, or an effect that makes one. */
export type Handler = (request: SentRequest) => Response | Effect.Effect<Response>

/** Every request the test client was sent, oldest first. */
export class Requests extends Context.Service<Requests, Ref.Ref<ReadonlyArray<SentRequest>>>()(
  "@nyc-transit-kit/fixtures/Requests"
) {}

const decodeJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))

const bodyOf = (request: HttpClientRequest.HttpClientRequest): unknown => {
  if (request.body._tag !== "Uint8Array") {
    return undefined
  }
  const text = new TextDecoder().decode(request.body.body)
  return Option.getOrElse(decodeJson(text), () => text)
}

/** An `HttpClient` that answers with `handler`, plus the `Requests` it records. */
export const layer = (handler: Handler): Layer.Layer<HttpClient.HttpClient | Requests> =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.map(Requests, (sent) =>
      HttpClient.make((request, url) => {
        const copy: SentRequest = {
          method: request.method,
          url,
          headers: request.headers,
          body: bodyOf(request)
        }
        return Ref.update(sent, (requests) => [...requests, copy]).pipe(
          Effect.andThen(
            Effect.suspend(() => {
              const answer = handler(copy)
              return Effect.isEffect(answer) ? answer : Effect.succeed(answer)
            })
          ),
          Effect.map((response) => HttpClientResponse.fromWeb(request, response))
        )
      })
    )
  ).pipe(Layer.provideMerge(Layer.effect(Requests, Ref.make<ReadonlyArray<SentRequest>>([]))))

/** The requests sent so far. */
export const requests: Effect.Effect<ReadonlyArray<SentRequest>, never, Requests> = Requests.use(
  Ref.get
)

// SODA3's real answers to what it refused on 2026-11-01.
const soda3Refusal = (request: SentRequest): Response | undefined => {
  const { pathname } = request.url
  if (!pathname.startsWith("/api/v3/")) {
    return undefined
  }
  if (request.headers["x-app-token"] === undefined) {
    return Response.json(soda3AuthenticationRequired, { status: 403 })
  }
  if (/\/export\.(json|geojson)$/.test(pathname)) {
    return Response.json(soda3ExportTypeUnavailable, { status: 406 })
  }
  const body: { readonly page?: unknown; readonly orderingSpecifier?: unknown } =
    typeof request.body === "object" && request.body !== null ? request.body : {}
  return body.page !== undefined && body.orderingSpecifier === "discard"
    ? Response.json(soda3DiscardWithPaging, { status: 400 })
    : undefined
}

/**
 * Answers like SODA3. `query` and `export` without an `X-App-Token` header get
 * Socrata's real 403, `export.json` and `export.geojson` its real 406, and a
 * page asked for with `orderingSpecifier: "discard"` its real 400. Everything
 * else gets `handler`. Discovery needs no token.
 */
export const soda3 = (handler: Handler) =>
  layer((request) => soda3Refusal(request) ?? handler(request))
