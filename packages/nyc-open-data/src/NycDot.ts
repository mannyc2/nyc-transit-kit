/**
 * NYC DOT datasets on NYC Open Data, each with the schema of its rows.
 *
 * Field names and types come from each dataset's Discovery column list. Socrata
 * leaves null cells out of a row, so a column is required only if it appeared
 * in every row of a 500-row sample taken on 2026-10-27.
 */
import type { Dataset } from "@nyc-transit-kit/soda3/Dataset"
import {
  FloatingTimestamp,
  MultiLineString,
  SocrataDatasetId
} from "@nyc-transit-kit/soda3/Socrata"
import * as Schema from "effect/Schema"
import { domain } from "./NycOpenData"

/** DOT Traffic Speeds, `i4gi-tjb9`. Every column is declared as Text. */
export const TrafficSpeedRow = Schema.Struct({
  id: Schema.String,
  speed: Schema.String,
  travel_time: Schema.String,
  status: Schema.String,
  data_as_of: FloatingTimestamp,
  link_id: Schema.String,
  link_points: Schema.String,
  encoded_poly_line: Schema.String,
  encoded_poly_line_lvls: Schema.String,
  owner: Schema.String,
  transcom_id: Schema.String,
  borough: Schema.String,
  link_name: Schema.String
})
export type TrafficSpeedRow = typeof TrafficSpeedRow.Type

/** Bus Lanes - Local Streets, `ycrg-ses3`. */
export const BusLaneRow = Schema.Struct({
  the_geom: MultiLineString,
  street: Schema.String,
  bltrafdir: Schema.String,
  segmentid: Schema.String,
  streetwidt: Schema.FiniteFromString,
  boro: Schema.String,
  facility: Schema.String,
  hours: Schema.String,
  days: Schema.String,
  days_code: Schema.FiniteFromString,
  lane_width: Schema.String,
  lane_type: Schema.String,
  year1: Schema.FiniteFromString,
  year2: Schema.FiniteFromString,
  year3: Schema.FiniteFromString,
  shape_leng: Schema.FiniteFromString,
  shape_le_1: MultiLineString,
  rw_type: Schema.optionalKey(Schema.String),
  lane_type1: Schema.optionalKey(Schema.String),
  lane_type2: Schema.optionalKey(Schema.String),
  lane_color: Schema.optionalKey(Schema.String),
  open_dates: Schema.optionalKey(Schema.String),
  last_updat: Schema.optionalKey(Schema.String),
  chron_id_1: Schema.optionalKey(Schema.String),
  direction: Schema.optionalKey(Schema.String),
  mid_block: Schema.optionalKey(Schema.String),
  sbs_route1: Schema.optionalKey(Schema.String),
  sbs_route2: Schema.optionalKey(Schema.String),
  sbs_route3: Schema.optionalKey(Schema.String)
})
export type BusLaneRow = typeof BusLaneRow.Type

const PmCount = Schema.optionalKey(Schema.FiniteFromString)

/** Traffic Volume Counts (Historical), `btm5-ppia`. One column per hour of the count day. */
export const TrafficVolumeRow = Schema.Struct({
  id: Schema.String,
  segmentid: Schema.FiniteFromString,
  roadway_name: Schema.String,
  from: Schema.String,
  to: Schema.String,
  direction: Schema.String,
  date: FloatingTimestamp,
  _12_00_1_00_am: Schema.FiniteFromString,
  _1_00_2_00am: Schema.FiniteFromString,
  _2_00_3_00am: Schema.FiniteFromString,
  _3_00_4_00am: Schema.FiniteFromString,
  _4_00_5_00am: Schema.FiniteFromString,
  _5_00_6_00am: Schema.FiniteFromString,
  _6_00_7_00am: Schema.FiniteFromString,
  _7_00_8_00am: Schema.FiniteFromString,
  _8_00_9_00am: Schema.FiniteFromString,
  _9_00_10_00am: Schema.FiniteFromString,
  _10_00_11_00am: Schema.FiniteFromString,
  _11_00_12_00pm: Schema.FiniteFromString,
  _12_00_1_00pm: PmCount,
  _1_00_2_00pm: PmCount,
  _2_00_3_00pm: PmCount,
  _3_00_4_00pm: PmCount,
  _4_00_5_00pm: PmCount,
  _5_00_6_00pm: PmCount,
  _6_00_7_00pm: PmCount,
  _7_00_8_00pm: PmCount,
  _8_00_9_00pm: PmCount,
  _9_00_10_00pm: PmCount,
  _10_00_11_00pm: PmCount,
  _11_00_12_00am: PmCount
})
export type TrafficVolumeRow = typeof TrafficVolumeRow.Type

export const datasets = {
  "bus-lanes-local-streets": {
    domain,
    datasetId: SocrataDatasetId.make("ycrg-ses3"),
    title: "Bus Lanes - Local Streets",
    description: "Bus lane centerlines on local streets, with hours, days and lane type.",
    row: BusLaneRow
  },
  "traffic-speeds": {
    domain,
    datasetId: SocrataDatasetId.make("i4gi-tjb9"),
    title: "DOT Traffic Speeds",
    description: "Near-realtime speed and travel time for each TRANSCOM link.",
    row: TrafficSpeedRow,
    timestampColumn: "data_as_of"
  },
  "traffic-volume-counts": {
    domain,
    datasetId: SocrataDatasetId.make("btm5-ppia"),
    title: "Traffic Volume Counts (Historical)",
    description: "Hourly vehicle counts per street segment and direction.",
    row: TrafficVolumeRow,
    timestampColumn: "date"
  }
} satisfies Record<string, Dataset>
export type DatasetName = keyof typeof datasets
