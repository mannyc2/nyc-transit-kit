import type { DatasetDescriptorAdapterStatus } from "@nyc-transit-kit/contracts/descriptors"
import type { GtfsFeedKind } from "@nyc-transit-kit/contracts/mta"
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
const s3 = "https://rrgtfsfeeds.s3.amazonaws.com/"
const dataservice = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/"
const staticFeed = (
  id: string,
  name: string,
  mode: MtaGtfsStaticFeedDescriptor["mode"],
  file: string
): MtaGtfsStaticFeedDescriptor => ({ id, name, surface: "gtfs-static", mode, url: `${s3}${file}` })
const realtimeFeed = (
  id: string,
  name: string,
  feed: GtfsFeedKind,
  family: MtaGtfsRealtimeFeedDescriptor["family"],
  path: string
): MtaGtfsRealtimeFeedDescriptor => ({
  id,
  name,
  surface: "gtfs-realtime",
  feed,
  family,
  url: `${dataservice}${path}`
})
const jsonFeed = (
  id: string,
  name: string,
  surface: MtaJsonDirectFeedDescriptor["surface"],
  url: string,
  options: Pick<MtaJsonDirectFeedDescriptor, "requiresApiKey" | "adapterStatus"> = {}
): MtaJsonDirectFeedDescriptor => ({ id, name, surface, format: "json", url, ...options })
type StaticFeedRecord = readonly [string, string, MtaGtfsStaticFeedDescriptor["mode"], string]
type RealtimeFeedRecord = readonly [string, string, string]
type JsonFeedRecord = readonly [
  string,
  string,
  MtaJsonDirectFeedDescriptor["surface"],
  string,
  Pick<MtaJsonDirectFeedDescriptor, "requiresApiKey" | "adapterStatus">?
]
const realtimeFeeds = (
  feed: GtfsFeedKind,
  family: MtaGtfsRealtimeFeedDescriptor["family"],
  records: ReadonlyArray<RealtimeFeedRecord>
) => records.map(([id, name, path]) => realtimeFeed(id, name, feed, family, path))
export const mtaGtfsStaticFeeds = (
  [
    ["subway-regular", "Subway Regular GTFS", "subway", "gtfs_subway.zip"],
    ["subway-supplemented", "Subway Supplemented GTFS", "subway", "gtfs_supplemented.zip"],
    ["lirr", "Long Island Rail Road GTFS", "rail", "gtfslirr.zip"],
    ["metro-north", "Metro-North Railroad GTFS", "rail", "gtfsmnr.zip"],
    ["bronx-bus", "Bronx Bus GTFS", "bus", "gtfs_bx.zip"],
    ["brooklyn-bus", "Brooklyn Bus GTFS", "bus", "gtfs_b.zip"],
    ["manhattan-bus", "Manhattan Bus GTFS", "bus", "gtfs_m.zip"],
    ["queens-bus", "Queens Bus GTFS", "bus", "gtfs_q.zip"],
    ["staten-island-bus", "Staten Island Bus GTFS", "bus", "gtfs_si.zip"],
    ["mta-bus-company", "MTA Bus Company GTFS", "bus", "gtfs_busco.zip"]
  ] satisfies ReadonlyArray<StaticFeedRecord>
).map(([id, name, mode, file]) => staticFeed(id, name, mode, file))
export const mtaGtfsRealtimeFeeds = [
  ...realtimeFeeds("trip-updates", "subway", [
    ["subway-ace", "Subway A/C/E GTFS-RT", "nyct%2Fgtfs-ace"],
    ["subway-bdfm", "Subway B/D/F/M GTFS-RT", "nyct%2Fgtfs-bdfm"],
    ["subway-g", "Subway G GTFS-RT", "nyct%2Fgtfs-g"],
    ["subway-jz", "Subway J/Z GTFS-RT", "nyct%2Fgtfs-jz"],
    ["subway-nqrw", "Subway N/Q/R/W GTFS-RT", "nyct%2Fgtfs-nqrw"],
    ["subway-l", "Subway L GTFS-RT", "nyct%2Fgtfs-l"],
    ["subway-1234567", "Subway 1/2/3/4/5/6/7 GTFS-RT", "nyct%2Fgtfs"],
    ["staten-island-railway", "Staten Island Railway GTFS-RT", "nyct%2Fgtfs-si"]
  ]),
  ...realtimeFeeds("trip-updates", "rail", [
    ["lirr", "Long Island Rail Road GTFS-RT", "lirr%2Fgtfs-lirr"],
    ["metro-north", "Metro-North Railroad GTFS-RT", "mnr%2Fgtfs-mnr"]
  ]),
  ...realtimeFeeds("alerts", "alerts", [
    ["alerts-all", "All MTA Service Alerts GTFS-RT", "camsys%2Fall-alerts"],
    ["alerts-subway", "Subway Service Alerts GTFS-RT", "camsys%2Fsubway-alerts"],
    ["alerts-bus", "Bus Service Alerts GTFS-RT", "camsys%2Fbus-alerts"],
    ["alerts-lirr", "LIRR Service Alerts GTFS-RT", "camsys%2Flirr-alerts"],
    ["alerts-metro-north", "Metro-North Service Alerts GTFS-RT", "camsys%2Fmnr-alerts"]
  ])
] satisfies ReadonlyArray<MtaGtfsRealtimeFeedDescriptor>
export const mtaJsonDirectFeeds = (
  [
    [
      "elevator-escalator-current",
      "Elevator/Escalator Status Current JSON",
      "elevator-escalator",
      `${dataservice}nyct%2Fnyct_ene.json`,
      { adapterStatus: "row-schema" }
    ],
    [
      "elevator-escalator-upcoming",
      "Elevator/Escalator Status Upcoming JSON",
      "elevator-escalator",
      `${dataservice}nyct%2Fnyct_ene_upcoming.json`
    ],
    [
      "elevator-escalator-equipment",
      "Elevator/Escalator Equipment JSON",
      "elevator-escalator",
      `${dataservice}nyct%2Fnyct_ene_equipments.json`
    ],
    [
      "bus-time-vehicle-monitoring",
      "Bus Time SIRI Vehicle Monitoring",
      "bus-time",
      "https://bustime.mta.info/api/siri/vehicle-monitoring.json",
      { requiresApiKey: true }
    ],
    [
      "bus-time-stop-monitoring",
      "Bus Time SIRI Stop Monitoring",
      "bus-time",
      "https://bustime.mta.info/api/siri/stop-monitoring.json",
      { requiresApiKey: true }
    ]
  ] satisfies ReadonlyArray<JsonFeedRecord>
).map(([id, name, surface, url, options]) => jsonFeed(id, name, surface, url, options ?? {}))
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
