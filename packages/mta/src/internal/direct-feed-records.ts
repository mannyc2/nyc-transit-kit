import type {
  MtaGtfsRealtimeFeedDescriptor,
  MtaGtfsStaticFeedDescriptor,
  MtaJsonDirectFeedDescriptor
} from "../feeds"

export const mtaGtfsStaticFeedRecords = [
  {
    id: "subway-regular",
    name: "Subway Regular GTFS",
    surface: "gtfs-static",
    mode: "subway",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip"
  },
  {
    id: "subway-supplemented",
    name: "Subway Supplemented GTFS",
    surface: "gtfs-static",
    mode: "subway",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_supplemented.zip"
  },
  {
    id: "lirr",
    name: "Long Island Rail Road GTFS",
    surface: "gtfs-static",
    mode: "rail",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip"
  },
  {
    id: "metro-north",
    name: "Metro-North Railroad GTFS",
    surface: "gtfs-static",
    mode: "rail",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfsmnr.zip"
  },
  {
    id: "bronx-bus",
    name: "Bronx Bus GTFS",
    surface: "gtfs-static",
    mode: "bus",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_bx.zip"
  },
  {
    id: "brooklyn-bus",
    name: "Brooklyn Bus GTFS",
    surface: "gtfs-static",
    mode: "bus",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_b.zip"
  },
  {
    id: "manhattan-bus",
    name: "Manhattan Bus GTFS",
    surface: "gtfs-static",
    mode: "bus",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_m.zip"
  },
  {
    id: "queens-bus",
    name: "Queens Bus GTFS",
    surface: "gtfs-static",
    mode: "bus",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_q.zip"
  },
  {
    id: "staten-island-bus",
    name: "Staten Island Bus GTFS",
    surface: "gtfs-static",
    mode: "bus",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_si.zip"
  },
  {
    id: "mta-bus-company",
    name: "MTA Bus Company GTFS",
    surface: "gtfs-static",
    mode: "bus",
    url: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_busco.zip"
  }
] satisfies ReadonlyArray<MtaGtfsStaticFeedDescriptor>

export const mtaGtfsRealtimeFeedRecords = [
  {
    id: "subway-ace",
    name: "Subway A/C/E GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "subway",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace"
  },
  {
    id: "subway-bdfm",
    name: "Subway B/D/F/M GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "subway",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm"
  },
  {
    id: "subway-g",
    name: "Subway G GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "subway",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g"
  },
  {
    id: "subway-jz",
    name: "Subway J/Z GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "subway",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz"
  },
  {
    id: "subway-nqrw",
    name: "Subway N/Q/R/W GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "subway",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw"
  },
  {
    id: "subway-l",
    name: "Subway L GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "subway",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l"
  },
  {
    id: "subway-1234567",
    name: "Subway 1/2/3/4/5/6/7 GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "subway",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs"
  },
  {
    id: "staten-island-railway",
    name: "Staten Island Railway GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "subway",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si"
  },
  {
    id: "lirr",
    name: "Long Island Rail Road GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "rail",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/lirr%2Fgtfs-lirr"
  },
  {
    id: "metro-north",
    name: "Metro-North Railroad GTFS-RT",
    surface: "gtfs-realtime",
    feed: "trip-updates",
    family: "rail",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr"
  },
  {
    id: "alerts-all",
    name: "All MTA Service Alerts GTFS-RT",
    surface: "gtfs-realtime",
    feed: "alerts",
    family: "alerts",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fall-alerts"
  },
  {
    id: "alerts-subway",
    name: "Subway Service Alerts GTFS-RT",
    surface: "gtfs-realtime",
    feed: "alerts",
    family: "alerts",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts"
  },
  {
    id: "alerts-bus",
    name: "Bus Service Alerts GTFS-RT",
    surface: "gtfs-realtime",
    feed: "alerts",
    family: "alerts",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fbus-alerts"
  },
  {
    id: "alerts-lirr",
    name: "LIRR Service Alerts GTFS-RT",
    surface: "gtfs-realtime",
    feed: "alerts",
    family: "alerts",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Flirr-alerts"
  },
  {
    id: "alerts-metro-north",
    name: "Metro-North Service Alerts GTFS-RT",
    surface: "gtfs-realtime",
    feed: "alerts",
    family: "alerts",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fmnr-alerts"
  }
] satisfies ReadonlyArray<MtaGtfsRealtimeFeedDescriptor>

export const mtaJsonDirectFeedRecords = [
  {
    id: "elevator-escalator-current",
    name: "Elevator/Escalator Status Current JSON",
    surface: "elevator-escalator",
    format: "json",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene.json"
  },
  {
    id: "elevator-escalator-upcoming",
    name: "Elevator/Escalator Status Upcoming JSON",
    surface: "elevator-escalator",
    format: "json",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene_upcoming.json"
  },
  {
    id: "elevator-escalator-equipment",
    name: "Elevator/Escalator Equipment JSON",
    surface: "elevator-escalator",
    format: "json",
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene_equipments.json"
  },
  {
    id: "bus-time-vehicle-monitoring",
    name: "Bus Time SIRI Vehicle Monitoring",
    surface: "bus-time",
    format: "json",
    requiresApiKey: true,
    url: "https://bustime.mta.info/api/siri/vehicle-monitoring.json"
  },
  {
    id: "bus-time-stop-monitoring",
    name: "Bus Time SIRI Stop Monitoring",
    surface: "bus-time",
    format: "json",
    requiresApiKey: true,
    url: "https://bustime.mta.info/api/siri/stop-monitoring.json"
  }
] satisfies ReadonlyArray<MtaJsonDirectFeedDescriptor>
