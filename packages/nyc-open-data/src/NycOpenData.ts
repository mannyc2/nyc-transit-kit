/**
 * NYC Open Data, `data.cityofnewyork.us`. Any dataset there is reachable by id
 * through `@nyc-transit-kit/soda3`; curated ones carry the schema of their rows.
 */
import type { Dataset } from "@nyc-transit-kit/soda3/Dataset"
import { SocrataDomain } from "@nyc-transit-kit/soda3/Socrata"

export const domain = SocrataDomain.make("data.cityofnewyork.us")

/** Curated datasets outside NYC DOT: none yet. NYC DOT's live in `NycDot`. */
export const datasets: Readonly<Record<string, Dataset>> = {}
