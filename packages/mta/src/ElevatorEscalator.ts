/**
 * NYCT elevator and escalator outages and equipment, as JSON feeds.
 */
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Schema from "effect/Schema"

const YesNo = Schema.Literals(["Y", "N"])
const EquipmentType = Schema.Literals(["EL", "ES"])

/** A row of `nyct_ene.json` (current outages) or `nyct_ene_upcoming.json`. */
export const Outage = Schema.Struct({
  station: Schema.String,
  borough: Schema.String,
  trainno: Schema.String,
  equipment: Schema.String,
  equipmenttype: EquipmentType,
  serving: Schema.String,
  ADA: YesNo,
  outagedate: Schema.String,
  estimatedreturntoservice: Schema.String,
  reason: Schema.String,
  isupcomingoutage: YesNo,
  ismaintenanceoutage: YesNo
})
export type Outage = typeof Outage.Type

/** A row of `nyct_ene_equipments.json`. */
export const Equipment = Schema.Struct({
  station: Schema.String,
  borough: Schema.String,
  trainno: Schema.String,
  equipmentno: Schema.String,
  equipmenttype: EquipmentType,
  serving: Schema.String,
  ADA: YesNo,
  isactive: YesNo,
  nonNYCT: YesNo,
  shortdescription: Schema.String,
  linesservedbyelevator: Schema.String,
  elevatorsgtfsstopid: Schema.String,
  elevatormrn: Schema.String,
  stationcomplexid: Schema.String,
  nextadanorth: Schema.String,
  nextadasouth: Schema.String,
  redundant: Schema.Literals([0, 1]),
  busconnections: Schema.String,
  alternativeroute: Schema.String
})
export type Equipment = typeof Equipment.Type

/** A JSON feed and the schema of one of its rows. */
export interface Feed<Row extends Schema.Codec<unknown, unknown> = Schema.Codec<unknown, unknown>> {
  readonly title: string
  readonly url: string
  readonly row: Row
}

const dataservice = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/"

// MTA serves these with the content type `${header.s3FileType}`; the body is JSON all the same.
export const feeds = {
  "elevator-escalator-current": {
    title:
      "Elevator and escalator outages, current and upcoming; isupcomingoutage tells them apart",
    url: `${dataservice}nyct%2Fnyct_ene.json`,
    row: Outage
  },
  "elevator-escalator-upcoming": {
    title: "Elevator and escalator outages, upcoming only",
    url: `${dataservice}nyct%2Fnyct_ene_upcoming.json`,
    row: Outage
  },
  "elevator-escalator-equipment": {
    title: "Elevator and escalator equipment",
    url: `${dataservice}nyct%2Fnyct_ene_equipments.json`,
    row: Equipment
  }
} satisfies Record<string, Feed>
export type FeedName = keyof typeof feeds

/** The feed's rows, decoded with its row schema. */
export const fetchRows = Effect.fn("ElevatorEscalator.fetchRows")(function* <
  Row extends Schema.Codec<unknown, unknown>
>(feed: Feed<Row>) {
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)
  const response = yield* client.get(feed.url)
  return yield* HttpClientResponse.schemaBodyJson(Schema.Array(feed.row))(response)
})
