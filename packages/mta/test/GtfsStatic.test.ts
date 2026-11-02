import { describe, expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as GtfsStatic from "../src/GtfsStatic"

const statenIsland = GtfsStatic.feeds["staten-island-bus"].url

// S3 answers a key it does not have with 403, since the bucket cannot be listed.
const bucket = HttpTest.layer((request) =>
  request.url.href === statenIsland
    ? new Response(request.method === "HEAD" ? null : Samples.gtfsStaticZipStart, {
        headers: Samples.gtfsStaticHeadHeaders
      })
    : new Response(Samples.gtfsStaticAccessDenied, {
        status: 403,
        headers: { "content-type": "application/xml" }
      })
)

describe("probe", () => {
  it.effect("sends HEAD and reports the zip's size and freshness", () =>
    Effect.gen(function* () {
      expect(yield* GtfsStatic.probe(statenIsland)).toEqual({
        url: statenIsland,
        contentType: "application/zip",
        contentLength: 6406562,
        lastModified: "Fri, 16 Oct 2026 15:14:44 GMT",
        etag: '"0f957f2ae9e9e0001e8d33d2a5c2149c"'
      })
      const [request] = yield* HttpTest.requests
      expect(request?.method).toBe("HEAD")
    }).pipe(Effect.provide(bucket))
  )

  it.effect("reports a header the server leaves out as null", () =>
    Effect.gen(function* () {
      expect(yield* GtfsStatic.probe(statenIsland)).toEqual({
        url: statenIsland,
        contentType: null,
        contentLength: null,
        lastModified: null,
        etag: null
      })
    }).pipe(Effect.provide(HttpTest.layer(() => new Response(null))))
  )

  it.effect("a missing zip fails with its status", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        GtfsStatic.probe("https://rrgtfsfeeds.s3.amazonaws.com/gtfs_missing.zip")
      )
      expect(error.reason._tag).toBe("StatusCodeError")
    }).pipe(Effect.provide(bucket))
  )
})

describe("stream", () => {
  it.effect("streams the zip's bytes as they arrive", () =>
    Effect.gen(function* () {
      const chunks = yield* Stream.runCollect(GtfsStatic.stream(statenIsland))
      expect(Buffer.concat(chunks)).toEqual(Buffer.from(Samples.gtfsStaticZipStart))
    }).pipe(Effect.provide(bucket))
  )

  it.effect("a missing zip fails the stream with its status", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Stream.runDrain(GtfsStatic.stream("https://rrgtfsfeeds.s3.amazonaws.com/gtfs_missing.zip"))
      )
      expect(error.reason._tag).toBe("StatusCodeError")
    }).pipe(Effect.provide(bucket))
  )
})
