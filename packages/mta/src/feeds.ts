import type { DatasetDescriptorAdapterStatus } from "@nyc-transit-kit/contracts/metadata"
import type { GtfsFeedKind } from "@nyc-transit-kit/contracts/mta"
import {
  mtaGtfsRealtimeFeedRecords,
  mtaGtfsStaticFeedRecords,
  mtaJsonDirectFeedRecords
} from "./internal/direct-feed-records"

export type MtaDirectFeedSurface =
  | "gtfs-static"
  | "gtfs-realtime"
  | "service-alerts"
  | "elevator-escalator"
  | "bus-time"

export interface MtaDirectFeedDescriptor {
  readonly id: string
  readonly name: string
  readonly surface: MtaDirectFeedSurface
  readonly url: string
  readonly description?: string
}

export interface MtaGtfsStaticFeedDescriptor extends MtaDirectFeedDescriptor {
  readonly surface: "gtfs-static"
  readonly mode: "subway" | "rail" | "bus"
}

export interface MtaGtfsRealtimeFeedDescriptor extends MtaDirectFeedDescriptor {
  readonly surface: "gtfs-realtime"
  readonly feed: GtfsFeedKind
  readonly family: "subway" | "rail" | "alerts"
}

export interface MtaJsonDirectFeedDescriptor extends MtaDirectFeedDescriptor {
  readonly surface: "service-alerts" | "elevator-escalator" | "bus-time"
  readonly format: "json" | "xml"
  readonly requiresApiKey?: boolean
  readonly adapterStatus?: DatasetDescriptorAdapterStatus
}

export const mtaGtfsStaticFeeds = mtaGtfsStaticFeedRecords

export const mtaGtfsRealtimeFeeds = mtaGtfsRealtimeFeedRecords

export const mtaJsonDirectFeeds = mtaJsonDirectFeedRecords

export const mtaDirectFeeds = [
  ...mtaGtfsStaticFeeds,
  ...mtaGtfsRealtimeFeeds,
  ...mtaJsonDirectFeeds
] satisfies ReadonlyArray<
  MtaGtfsStaticFeedDescriptor | MtaGtfsRealtimeFeedDescriptor | MtaJsonDirectFeedDescriptor
>

const normalizedLookupKey = (value: string) => value.trim().toLowerCase()

const findFeed = <Feed extends MtaDirectFeedDescriptor>(
  feeds: ReadonlyArray<Feed>,
  key: string
) => {
  const normalized = normalizedLookupKey(key)
  return feeds.find(
    (feed) =>
      normalizedLookupKey(feed.id) === normalized || normalizedLookupKey(feed.name) === normalized
  )
}

export const findMtaGtfsStaticFeed = (key: string) => findFeed(mtaGtfsStaticFeeds, key)

export const findMtaGtfsRealtimeFeed = (key: string) => findFeed(mtaGtfsRealtimeFeeds, key)

export const findMtaJsonDirectFeed = (key: string) => findFeed(mtaJsonDirectFeeds, key)
