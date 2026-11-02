/**
 * MTA GTFS static schedules: zip files on the MTA's S3 bucket.
 */
import * as Effect from "effect/Effect"
import * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Option from "effect/Option"

export interface Feed {
  readonly title: string
  readonly mode: "subway" | "rail" | "bus"
  readonly url: string
}

const feed = (title: string, mode: Feed["mode"], file: string): Feed => ({
  title,
  mode,
  url: `https://rrgtfsfeeds.s3.amazonaws.com/${file}`
})

export const feeds = {
  "subway-regular": feed("Subway Regular GTFS", "subway", "gtfs_subway.zip"),
  "subway-supplemented": feed("Subway Supplemented GTFS", "subway", "gtfs_supplemented.zip"),
  lirr: feed("Long Island Rail Road GTFS", "rail", "gtfslirr.zip"),
  "metro-north": feed("Metro-North Railroad GTFS", "rail", "gtfsmnr.zip"),
  "bronx-bus": feed("Bronx Bus GTFS", "bus", "gtfs_bx.zip"),
  "brooklyn-bus": feed("Brooklyn Bus GTFS", "bus", "gtfs_b.zip"),
  "manhattan-bus": feed("Manhattan Bus GTFS", "bus", "gtfs_m.zip"),
  "queens-bus": feed("Queens Bus GTFS", "bus", "gtfs_q.zip"),
  "staten-island-bus": feed("Staten Island Bus GTFS", "bus", "gtfs_si.zip"),
  "mta-bus-company": feed("MTA Bus Company GTFS", "bus", "gtfs_busco.zip")
} satisfies Record<string, Feed>
export type FeedName = keyof typeof feeds

const okClient = Effect.map(HttpClient.HttpClient, HttpClient.filterStatusOk)

/** HEAD a zip: its size and freshness without downloading it. Missing headers are null. */
export const probe = Effect.fn("GtfsStatic.probe")(function* (url: string) {
  const client = yield* okClient
  const { headers } = yield* client.head(url)
  const header = (name: string) => Option.getOrNull(Headers.get(headers, name))
  const contentLength = header("content-length")
  return {
    url,
    contentType: header("content-type"),
    contentLength: contentLength === null ? null : Number(contentLength),
    lastModified: header("last-modified"),
    etag: header("etag")
  }
})

/** The zip's bytes as they arrive. */
export const stream = (url: string) =>
  HttpClientResponse.stream(Effect.flatMap(okClient, (client) => client.get(url)))
