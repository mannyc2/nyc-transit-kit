/**
 * MTA datasets on NYS Open Data, `data.ny.gov`. Any other dataset there is
 * reachable by id through `@nyc-transit-kit/soda3`.
 */
import type { Dataset } from "@nyc-transit-kit/soda3/Dataset"
import { FloatingTimestamp, SocrataDatasetId, SocrataDomain } from "@nyc-transit-kit/soda3/Socrata"
import * as Schema from "effect/Schema"

export const domain = SocrataDomain.make("data.ny.gov")

/**
 * A row of the MTA Open Data Catalog, `f462-ka72`. `open_dataset_id` is the
 * Socrata id once a dataset is published (`kir5-i9xt`) and the MTA's own number
 * while it is planned (`11`). Only published rows carry `nys_url`.
 */
export const CatalogRow = Schema.Struct({
  open_dataset_id: Schema.String,
  dataset_title: Schema.String,
  status: Schema.String,
  plan_submission_date: Schema.String,
  description: Schema.optionalKey(Schema.String),
  plan_submission_date_notes: Schema.optionalKey(Schema.String),
  type: Schema.optionalKey(Schema.String),
  agency: Schema.optionalKey(Schema.String),
  posting_frequency: Schema.optionalKey(Schema.String),
  dataset_created_at: Schema.optionalKey(FloatingTimestamp),
  nys_url: Schema.optionalKey(Schema.Struct({ url: Schema.String }))
})
export type CatalogRow = typeof CatalogRow.Type

export const datasets = {
  catalog: {
    domain,
    datasetId: SocrataDatasetId.make("f462-ka72"),
    title: "MTA Open Data Catalog",
    description:
      "Every dataset the MTA publishes or plans to publish, with its NYS Open Data link.",
    row: CatalogRow,
    timestampColumn: "dataset_created_at"
  }
} satisfies Record<string, Dataset>
export type DatasetName = keyof typeof datasets
