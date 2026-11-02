import { describe, expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as Effect from "effect/Effect"
import * as Discovery from "../src/Discovery"
import { SocrataDatasetId, SocrataDomain } from "../src/Socrata"

const domain = SocrataDomain.make("data.cityofnewyork.us")
const datasetId = SocrataDatasetId.make("i4gi-tjb9")

describe("search", () => {
  it.effect("searches one domain's datasets and decodes the real response", () =>
    Effect.gen(function* () {
      const response = yield* Discovery.search({ domain, query: "traffic speeds", limit: 5 })
      expect(response.results[0]?.resource.name).toBe("DOT Traffic Speeds")
      const [request] = yield* HttpTest.requests
      expect(request?.method).toBe("GET")
      expect(`${request?.url.origin}${request?.url.pathname}`).toBe(Discovery.url)
      expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
        domains: "data.cityofnewyork.us",
        search_context: "data.cityofnewyork.us",
        only: "dataset",
        q: "traffic speeds",
        limit: "5"
      })
      // Discovery is public: no app token goes with it.
      expect(request?.headers["x-app-token"]).toBeUndefined()
    }).pipe(Effect.provide(HttpTest.soda3(() => Response.json(Samples.catalogSearchResponse))))
  )

  it.effect("Discovery's error sentence becomes the message", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Discovery.search({ domain: SocrataDomain.make("not-a-domain.example") })
      )
      expect(error).toMatchObject({
        _tag: "SocrataError",
        status: 404,
        message: Samples.discoveryDomainNotFound.error
      })
    }).pipe(
      Effect.provide(
        HttpTest.soda3(() => Response.json(Samples.discoveryDomainNotFound, { status: 404 }))
      )
    )
  )
})

describe("metadata", () => {
  it.effect("asks for the id and returns its result", () =>
    Effect.gen(function* () {
      const result = yield* Discovery.metadata({ domain, datasetId })
      expect(result.resource.id).toBe(datasetId)
      const [request] = yield* HttpTest.requests
      expect(request?.url.searchParams.get("ids")).toBe("i4gi-tjb9")
    }).pipe(Effect.provide(HttpTest.soda3(() => Response.json(Samples.catalogSearchResponse))))
  )

  it.effect("an id Discovery does not know is DatasetNotFound, not an empty success", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Discovery.metadata({ domain, datasetId }))
      expect(error._tag).toBe("DatasetNotFound")
      expect(error.message).toBe("data.cityofnewyork.us has no public dataset i4gi-tjb9")
    }).pipe(Effect.provide(HttpTest.soda3(() => Response.json(Samples.discoveryNoResults))))
  )

  it.effect("a result for another id is not taken for the one asked about", () =>
    Effect.gen(function* () {
      const other = SocrataDatasetId.make("ycrg-ses3")
      const error = yield* Effect.flip(Discovery.metadata({ domain, datasetId: other }))
      expect(error._tag).toBe("DatasetNotFound")
    }).pipe(Effect.provide(HttpTest.soda3(() => Response.json(Samples.catalogSearchResponse))))
  )
})

it.effect("columns zips Discovery's parallel column arrays", () =>
  Effect.gen(function* () {
    const result = yield* Discovery.metadata({ domain, datasetId })
    const columns = Discovery.columns(result)
    expect(columns).toHaveLength(result.resource.columns_field_name.length)
    expect(columns.find((column) => column.field === "data_as_of")).toEqual({
      field: "data_as_of",
      name: "DATA_AS_OF",
      datatype: "Calendar date",
      description: ""
    })
  }).pipe(Effect.provide(HttpTest.soda3(() => Response.json(Samples.catalogSearchResponse))))
)
