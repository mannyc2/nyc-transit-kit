# Official API Map

The provider surfaces the toolkit models, and what live requests showed about
them. Each fact carries the date it was checked. Coverage policy is in
[Provider coverage](provider-coverage.md).

## Socrata SODA3 And Discovery

- Provider: Socrata (Tyler Data & Insights).
- Modelled: SODA3 query and export on any domain, Discovery search and dataset
  lookup, SoQL with values written as literals, pagination, byte-range export
  probes. Retries and timeouts are left to the caller.
- Facts:
  - 2026-07-04: SODA3 data endpoints are `POST /api/v3/views/{id}/query.json`
    and `POST /api/v3/views/{id}/export.{format}`. No `/api/v3/views/{id}`
    metadata or columns endpoint exists.
  - 2026-07-04: Discovery, `GET https://api.us.socrata.com/api/catalog/v1`,
    finds one dataset with `domains`, `search_context`, `only=dataset` and
    `ids`. Results carry the domain under `metadata.domain` and columns as
    four parallel arrays: `columns_name`, `columns_field_name`,
    `columns_datatype`, `columns_description`.
  - 2026-10-27: without an app token, `query.json` answers 403
    `{"code":"authentication_required","error":true,"message":"This request must be authenticated or have an application token"}`.
  - 2026-10-27: with an invalid token, it answers 403 with code
    `permission_denied` and the message "Invalid app_token specified".
  - 2026-10-27: Discovery's search text parameter is `q`. An unknown domain
    answers 404 `{"error":"Domain not found: …"}`, a different body shape from
    SODA3's.
  - 2026-10-27: Discovery `resource.attribution` is often `null`.
  - 2026-11-01: with a token, `query.json` answered every query with a bare
    JSON array of rows, never `{ rows }`. Numbers arrive as text and null cells
    are left out, as on Socrata's public row API: the rows behind the samples in
    `@nyc-transit-kit/fixtures` matched value for value. Each row, projections
    included, ends with the system columns `:id`, `:version`, `:created_at` and
    `:updated_at`, unless the body sets `includeSystem` or `includeSynthetic` to
    false. Aggregates carry none: `count(*)` came back as
    `[{"count":"33539349"}]`, the count a string.
  - 2026-11-01: SODA3 has no default limit. `SELECT id` with neither `LIMIT`
    nor `page` returned all 42,756 rows of `btm5-ppia`, 6.5 MB.
  - 2026-11-01: `page` is 1-indexed and slices the query's result. With an
    `ORDER BY`, pages 1 and 2 of size 2 equalled `LIMIT 4`, and `LIMIT 3` with
    page 2 gave the third row alone. Without one (the default
    `orderingSpecifier` is `total`), static `btm5-ppia` paged the same way, but
    Traffic Speeds came back newest first, and requests seconds apart disagreed
    on the newest rows by up to two (each response said
    `x-soda2-data-out-of-date`), so page 2 repeated page 1. Ordered by
    `data_as_of` or `` `:id` ``, its pages held. `orderingSpecifier: "discard"`
    with `page` answers 400 `invalid_request`, "Cannot discard ordering and use
    paging".
  - 2026-11-01: `export.csv` answered 200 with `text/csv`, chunked, display
    names in the header row and timestamps written like
    `2026 Oct 26 10:48:03 PM`. It ignored `Range: bytes=0-63` and sent the
    whole file, without `Content-Range` or `Accept-Ranges`. `export.json` and
    `export.geojson` answered 406 `unacceptable_response_type`, "Requested type
    is not available", on Traffic Speeds, Bus Lanes and the MTA catalog, with
    or without a JSON `accept` header.
  - 2026-11-01: SODA3's documentation describes the query body's `parameters`
    only as "Some views require parameters to be provided by the user. Details
    to be provided at a later date". It documents no placeholder syntax for
    ordinary queries, and lists `includeSystem` and `includeSynthetic` as
    defaulting to true.
  - 2026-11-01: in SoQL, `:name` names a system column, not a placeholder. On
    SODA3, 0.2.0's `SELECT * WHERE borough = :borough` with
    `parameters: { borough: "Queens" }` answered 400
    `soql.analyzer.typechecker.no-such-column`, "No such column `:borough'
    (Perhaps you meant `borough')". Socrata's public row API refused the same
    query with `query.soql.no-such-column`.
  - 2026-11-01: on SODA3, backticked identifiers with single-quoted literals
    worked, the reserved words `from` and `to` included. A quote doubled inside
    a literal matched (`LIKE '%''%'` found "car's"), and a backslash escape
    failed with `soql.parser.unexpected-end-of-input`
    (`query.compiler.malformed` on the public row API). A floating timestamp
    without milliseconds, `'2026-10-26T22:48:03'`, matched a row stamped
    `2026-10-26T22:48:03.000`. `IN`, `IS NOT NULL`, `OR` and `ORDER BY … DESC`
    ran, and a number column matched both `29025` and `'29025'`.
  - 2026-11-01: SODA3 answers an unknown dataset id with 404
    `{"code":"not_found","error":true,"message":"Not found","data":{"id":"zzzz-zzzz"}}`.
    A query it cannot run gets 400, with `status`, `data` and `source` (the
    query and the position) beside `code`, `error` and `message`.
  - 2026-11-01: Discovery answers an id the domain does not have with HTTP 200
    and `{"results":[],"resultSetSize":0,…}`, not a 404.
- Sources: https://dev.socrata.com/docs/endpoints,
  https://dev.socrata.com/docs/queries/,
  https://dev.socrata.com/docs/queries/parameters,
  https://dev.socrata.com/docs/other/discovery,
  https://dev.socrata.com/docs/app-tokens,
  https://support.socrata.com/hc/en-us/articles/34730618169623-SODA3-API

## MTA Feeds

- Provider: Metropolitan Transportation Authority.
- Modelled: GTFS static zips (HEAD probe and download), GTFS-realtime (decode,
  summary, capture), elevator and escalator JSON with row schemas, and Bus Time
  SIRI as raw JSON.
- Facts:
  - Static bus GTFS is published per borough and is generally updated
    quarterly. Many GTFS-realtime feeds use MTA extensions; the kit keeps them
    in the decoded message and does not interpret them.
  - Bus Time needs an API key, sent as the `key` query parameter.
  - 2026-10-27: GTFS-realtime and elevator feeds answer without a key.
  - 2026-10-27: a static zip `HEAD` returns `Content-Type: application/zip`,
    `Content-Length`, `Last-Modified` and `ETag`.
  - 2026-10-27: the elevator JSON arrives with the literal header
    `content-type: ${header.s3FileType}`. The body is JSON.
  - 2026-10-27: `nyct_ene.json`, the "current" outages, includes upcoming ones.
    It had 120 rows, 84 with `isupcomingoutage: "Y"`, and those 84 were exactly
    the rows of `nyct_ene_upcoming.json`.
  - 2026-10-27: subway and Staten Island Railway feed headers say
    `gtfsRealtimeVersion: "1.0"` and leave out `incrementality`, which defaults
    to `FULL_DATASET`. The LIRR and alert feeds say `"2.0"` and set it.
  - 2026-11-01: a GTFS-realtime path with no feed behind it
    (`nyct%2Fgtfs-missing`) answers HTTP 200 with `content-type:
    application/xml` and S3's `NoSuchKey` error. Only decoding the body tells it
    from a feed.
  - 2026-11-01: the API gateway answers a route it does not serve with 403
    `{"message":"Forbidden"}`, and `HEAD` on a feed with 403 too, so feeds are
    probed with `GET`.
  - 2026-11-01: the static bucket answers a missing zip with 403 and S3's
    `AccessDenied` XML, not 404. It honours `Range` with 206.
    `gtfs_si.zip` was 6,406,562 bytes, last modified Fri, 16 Oct 2026 15:14:44
    GMT.
  - 2026-11-01: Bus Time without a key answers 401 with a SIRI body whose
    `ErrorCondition` says "API key required.".
- Sources: https://www.mta.info/developers,
  https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene.json

## MTA Open Data

- Provider: the MTA, through NYS Open Data (`data.ny.gov`).
- Modelled: the MTA Open Data Catalog as a curated dataset; any other
  `data.ny.gov` dataset by id.
- Facts:
  - The MTA Open Data Catalog lists the datasets the MTA shares or plans to
    share on `data.ny.gov`.
  - 2026-10-27: a published row's `open_dataset_id` is its Socrata id
    (`kir5-i9xt`); a planned row's is the MTA's own number (`11`). Only
    published rows carry `nys_url`.
- Sources: https://www.mta.info/open-data,
  https://data.ny.gov/Transportation/MTA-Open-Data-Catalog/f462-ka72

## NYC Open Data

- Provider: the City of New York (`data.cityofnewyork.us`).
- Modelled: the domain, catalog search, and any dataset by id. No curated
  datasets outside DOT yet.
- Sources: https://opendata.cityofnewyork.us/,
  https://dev.socrata.com/foundry/data.cityofnewyork.us/

## NYC DOT

- Provider: the New York City Department of Transportation, through NYC Open
  Data.
- Modelled: Bus Lanes - Local Streets (`ycrg-ses3`), DOT Traffic Speeds
  (`i4gi-tjb9`) and Traffic Volume Counts (Historical) (`btm5-ppia`), each with
  a row schema.
- Facts:
  - 2026-11-01: every Traffic Speeds column is declared as Text, `speed`
    included, except `data_as_of`, a floating timestamp (Discovery says
    "Calendar date"; SODA3's `X-SODA2-Types` header says `floating_timestamp`).
    The table holds 113,269,686 rows.
  - 2026-10-27: Traffic Speeds spells one borough two ways: 24,177,025 rows say
    "Staten Island" and 406,745 say "Staten island". A filter on one spelling
    misses the other.
  - 2026-10-27: Bus Lanes `boro` holds codes, not names: `BK`, `BX`, `MAN`,
    `QNS`, `SI`, and `BX, MN` for segments on the border.
  - 2026-10-27: Traffic Volume Counts keeps its timestamp in `date`.
- Sources: https://www.nyc.gov/html/dot/html/about/datafeeds.shtml,
  https://data.cityofnewyork.us/Transportation/Bus-Lanes-Local-Streets/ycrg-ses3,
  https://data.cityofnewyork.us/Transportation/DOT-Traffic-Speeds/i4gi-tjb9,
  https://data.cityofnewyork.us/Transportation/Traffic-Volume-Counts-Historical-/btm5-ppia
