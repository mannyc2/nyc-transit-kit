# Official API Map

Last verified: 2026-06-29.

This file records the provider surfaces the v0 toolkit is allowed to model.

Coverage policy: see [Provider Coverage](provider-coverage.md). Source counts
are counted by `scripts/check-provider-coverage.ts` from local official-source
snapshots, not hand-maintained in this document.

## Socrata SODA3

- Provider: Socrata / Tyler Data & Insights.
- Backing model: Socrata-backed.
- v0 scope: generic query, export, catalog search/info, app-token header wiring,
  pagination, range probes, retries, and typed provider errors.
- Verified facts:
  - Socrata documents SODA3 query and export endpoints under
    `/api/v3/views/<dataset>/query.json` and `/api/v3/views/<dataset>/export`.
  - Socrata recommends POST for queries because it supports longer queries and
    clearer options.
  - Socrata's Discovery API is the catalog surface for searching assets.
- Sources:
  - https://dev.socrata.com/docs/queries/
  - https://dev.socrata.com/docs/other/discovery

## MTA Developer Resources

- Provider: Metropolitan Transportation Authority.
- Backing model: mixed direct feeds and Socrata-backed Open Data.
- v0 scope: GTFS static feed probes/fetches, standard GTFS Realtime
  probes/decoding, MTA Open Data dataset descriptors, and delegation to
  `packages/soda3` when data is hosted on `data.ny.gov`.
- Verified facts:
  - MTA publishes static bus GTFS feeds by borough/feed group and notes they are
    generally updated quarterly.
  - MTA provides subway, rail, and alert realtime feeds in GTFS-RT format.
  - MTA notes that many GTFS-RT feeds use custom extensions; v0 keeps those
    fields in raw decoded data and does not yet normalize every extension.
  - MTA bus realtime data is provided through Bus Time APIs and requires an API
    key.
  - The elevator/escalator current JSON direct feed returns an array of outage
    rows with source fields such as `station`, `equipment`, `equipmenttype`,
    `outagedate`, `estimatedreturntoservice`, and `reason`.
- Source:
  - https://www.mta.info/developers
  - https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene.json

## MTA Open Data

- Provider: Metropolitan Transportation Authority via NYS Open Data.
- Backing model: Socrata-backed for `data.ny.gov` datasets.
- v0 scope: dataset descriptors and SODA3-backed access through `packages/soda3`.
- Verified facts:
  - MTA's Open Data program points users to the NYS Open Data Portal.
  - The MTA Open Data Catalog lists datasets MTA currently shares or plans to
    share on `data.ny.gov`.
- Sources:
  - https://www.mta.info/open-data
  - https://data.ny.gov/Transportation/MTA-Open-Data-Catalog/f462-ka72

## NYC Open Data

- Provider: City of New York / NYC Open Data.
- Backing model: Socrata-backed for `data.cityofnewyork.us` datasets.
- v0 scope: domain defaults, catalog/dataset descriptor helpers, SODA3-backed
  query/export helpers, and safe fixture descriptors.
- Verified facts:
  - NYC Open Data describes itself as free public data from City agencies and
    partners.
  - Socrata Foundry pages for `data.cityofnewyork.us` expose API docs for NYC
    datasets.
- Sources:
  - https://opendata.cityofnewyork.us/
  - https://dev.socrata.com/foundry/data.cityofnewyork.us/

## NYC DOT

- Provider: New York City Department of Transportation.
- Backing model: mostly Socrata-backed where surfaced through NYC Open Data.
- v0 scope: DOT dataset descriptors and thin typed adapters for transit/street
  datasets hosted through NYC Open Data.
- Initial dataset surfaces:
  - Bus Lanes - Local Streets: `ycrg-ses3`.
  - DOT Traffic Speeds: `i4gi-tjb9`.
  - Traffic Volume Counts (Historical): `btm5-ppia`.
- Verified facts:
  - NYC DOT directs users to NYC Open Data for public datasets and APIs.
  - NYC DOT's data page groups useful surfaces such as bus lanes, realtime
    traffic, vehicle and pedestrian counts, and bridge/traffic volume data.
- Sources:
  - https://www.nyc.gov/html/dot/html/about/datafeeds.shtml
  - https://data.cityofnewyork.us/Transportation/Bus-Lanes-Local-Streets/ycrg-ses3
  - https://data.cityofnewyork.us/Transportation/DOT-Traffic-Speeds/i4gi-tjb9
  - https://data.cityofnewyork.us/Transportation/Traffic-Volume-Counts-Historical-/btm5-ppia
