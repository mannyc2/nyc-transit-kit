import * as Schema from "effect/Schema"
export const packageName = "@nyc-transit-kit/contracts"
export const schemaVersion = "0.1.0"
export const releaseVersion = "0.2.0"
export const ApiFamily = Schema.Literals(["socrata", "mta", "nyc-open-data", "nyc-dot"])
export type ApiFamily = typeof ApiFamily.Type
