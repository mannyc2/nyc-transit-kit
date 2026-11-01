import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpTest from "../src/HttpTest"
import * as Samples from "../src/Samples"

const send = (request: HttpClientRequest.HttpClientRequest) =>
  HttpClient.HttpClient.use((client) => client.execute(request))

describe("layer", () => {
  it.effect("answers with the handler and records what was sent", () =>
    Effect.gen(function* () {
      const response = yield* send(
        HttpClientRequest.post("https://example.test/rows?limit=2").pipe(
          HttpClientRequest.setHeader("x-app-token", "token"),
          HttpClientRequest.bodyJsonUnsafe({ query: "SELECT *" })
        )
      )
      expect(yield* response.json).toEqual(Samples.trafficSpeedRows)
      yield* send(HttpClientRequest.get("https://example.test/feed"))
      const [post, get] = yield* HttpTest.requests
      expect(post).toMatchObject({ method: "POST", body: { query: "SELECT *" } })
      expect(post?.url.searchParams.get("limit")).toBe("2")
      expect(post?.headers["x-app-token"]).toBe("token")
      expect(get).toMatchObject({ method: "GET", body: undefined })
    }).pipe(Effect.provide(HttpTest.layer(() => Response.json(Samples.trafficSpeedRows))))
  )

  it.effect("keeps a body that is not JSON as text", () =>
    Effect.gen(function* () {
      yield* send(
        HttpClientRequest.post("https://example.test/").pipe(HttpClientRequest.bodyText("not json"))
      )
      const [request] = yield* HttpTest.requests
      expect(request?.body).toBe("not json")
    }).pipe(Effect.provide(HttpTest.layer(() => new Response(null))))
  )

  it.effect("a handler may answer with an Effect", () =>
    Effect.gen(function* () {
      const response = yield* send(HttpClientRequest.get("https://example.test/"))
      expect(response.status).toBe(204)
    }).pipe(
      Effect.provide(HttpTest.layer(() => Effect.succeed(new Response(null, { status: 204 }))))
    )
  )
})

describe("soda3", () => {
  const answered = HttpTest.soda3(() => Response.json(Samples.trafficSpeedRows))
  const query = "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9/query.json"

  it.effect("refuses SODA3 without an app token, as Socrata does", () =>
    Effect.gen(function* () {
      const response = yield* send(HttpClientRequest.post(query))
      expect(response.status).toBe(403)
      expect(yield* response.json).toEqual(Samples.soda3AuthenticationRequired)
    }).pipe(Effect.provide(answered))
  )

  it.effect("refuses the exports and paging SODA3 refuses, with its real answers", () =>
    Effect.gen(function* () {
      const withToken = (request: HttpClientRequest.HttpClientRequest) =>
        send(request.pipe(HttpClientRequest.setHeader("x-app-token", "token")))
      const views = "https://data.cityofnewyork.us/api/v3/views/i4gi-tjb9"
      for (const format of ["json", "geojson"]) {
        const refused = yield* withToken(HttpClientRequest.post(`${views}/export.${format}`))
        expect(refused.status).toBe(406)
        expect(yield* refused.json).toEqual(Samples.soda3ExportTypeUnavailable)
      }
      const csv = yield* withToken(HttpClientRequest.post(`${views}/export.csv`))
      expect(csv.status).toBe(200)
      const page = { pageNumber: 2, pageSize: 2 }
      const discarded = yield* withToken(
        HttpClientRequest.post(query).pipe(
          HttpClientRequest.bodyJsonUnsafe({
            query: "SELECT *",
            page,
            orderingSpecifier: "discard"
          })
        )
      )
      expect(discarded.status).toBe(400)
      expect(yield* discarded.json).toEqual(Samples.soda3DiscardWithPaging)
      const unpaged = yield* withToken(
        HttpClientRequest.post(query).pipe(
          HttpClientRequest.bodyJsonUnsafe({ query: "SELECT *", orderingSpecifier: "discard" })
        )
      )
      expect(unpaged.status).toBe(200)
    }).pipe(Effect.provide(answered))
  )

  it.effect("passes SODA3 with a token, and Discovery without one", () =>
    Effect.gen(function* () {
      const withToken = yield* send(
        HttpClientRequest.post(query).pipe(HttpClientRequest.setHeader("x-app-token", "token"))
      )
      expect(withToken.status).toBe(200)
      const discovery = yield* send(
        HttpClientRequest.get("https://api.us.socrata.com/api/catalog/v1")
      )
      expect(discovery.status).toBe(200)
      expect(yield* HttpTest.requests).toHaveLength(2)
    }).pipe(Effect.provide(answered))
  )
})
