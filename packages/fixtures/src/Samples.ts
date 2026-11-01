/**
 * Real responses, cut down to a few rows. Each says where and when it was
 * captured. The Socrata rows are SODA3 `query.json` answers, so they end with
 * the four system columns SODA3 adds to every row unless asked not to.
 */

/** DOT Traffic Speeds, https://data.cityofnewyork.us/d/i4gi-tjb9. SODA3, captured 2026-11-01. */
export const trafficSpeedRows = [
  {
    id: "385",
    speed: "58.4",
    travel_time: "24",
    status: "0",
    data_as_of: "2026-10-26T22:48:03.000",
    link_id: "4616208",
    link_points: "40.6077805,-74.14091 40.60826,-74.132101",
    encoded_poly_line: "sezvFtsocM_Bav@",
    encoded_poly_line_lvls: "BB",
    owner: "NYC_DOT_LIC",
    transcom_id: "4616208",
    borough: "Staten Island",
    link_name: "SIE W BRADLEY AVENUE - WOOLEY AVENUE",
    ":id": "row-zq34_d2e8.ai9w",
    ":version": "rv-djzp_f3v7.p5p4",
    ":created_at": "2026-10-27T02:53:47.095Z",
    ":updated_at": "2026-10-27T02:53:47.095Z"
  },
  {
    id: "385",
    speed: "57.78",
    travel_time: "24",
    status: "0",
    data_as_of: "2026-10-26T22:58:04.000",
    link_id: "4616208",
    link_points: "40.6077805,-74.14091 40.60826,-74.132101",
    encoded_poly_line: "sezvFtsocM_Bav@",
    encoded_poly_line_lvls: "BB",
    owner: "NYC_DOT_LIC",
    transcom_id: "4616208",
    borough: "Staten Island",
    link_name: "SIE W BRADLEY AVENUE - WOOLEY AVENUE",
    ":id": "row-8c85.dkru~t6rh",
    ":version": "rv-4wkd.cesa-pqvz",
    ":created_at": "2026-10-27T09:23:36.742Z",
    ":updated_at": "2026-10-27T09:23:36.742Z"
  }
] as const

/** Bus Lanes - Local Streets, https://data.cityofnewyork.us/d/ycrg-ses3. SODA3, captured 2026-11-01. */
export const busLaneRows = [
  {
    the_geom: {
      type: "MultiLineString",
      coordinates: [
        [
          [-73.91823255904289, 40.77147885672931],
          [-73.91725912479616, 40.77077252718062]
        ]
      ]
    },
    street: "HOYT AVENUE NORTH",
    bltrafdir: "A",
    segmentid: "0111705",
    streetwidt: "0.0",
    boro: "QNS",
    facility: "Hoyt Avenue North",
    direction: "WB",
    hours: "24 Hours",
    days: "7 Days/Week",
    days_code: "7.0",
    lane_width: "Single",
    lane_type: "Curbside",
    lane_type2: "Enhanced Bus Stop",
    lane_color: "No",
    year1: "2020",
    year2: "0",
    year3: "0",
    chron_id_1: "QNS2020",
    shape_leng: "372.722579645",
    shape_le_1: {
      type: "MultiLineString",
      coordinates: [
        [
          [1006898.2315856367, 220357.9087844193],
          [1007168.0997984558, 220100.82267221808]
        ]
      ]
    },
    ":id": "row-vdsx~nrfy_n55f",
    ":version": "rv-bydj-akf8-6gq4",
    ":created_at": "2026-04-06T15:44:01.865Z",
    ":updated_at": "2026-04-06T15:44:01.865Z"
  }
] as const

/**
 * Traffic Volume Counts, https://data.cityofnewyork.us/d/btm5-ppia. The second
 * row has no PM counts. SODA3, captured 2026-11-01.
 */
export const trafficVolumeRows = [
  {
    id: "313",
    segmentid: "29025",
    roadway_name: "UNION ST",
    from: "7 AVE",
    to: "8 AVE",
    direction: "EB",
    date: "2012-01-13T00:00:00.000",
    _12_00_1_00_am: "82",
    _1_00_2_00am: "46",
    _2_00_3_00am: "45",
    _3_00_4_00am: "26",
    _4_00_5_00am: "37",
    _5_00_6_00am: "73",
    _6_00_7_00am: "164",
    _7_00_8_00am: "201",
    _8_00_9_00am: "256",
    _9_00_10_00am: "134",
    _10_00_11_00am: "233",
    _11_00_12_00pm: "47",
    _12_00_1_00pm: "238",
    _1_00_2_00pm: "97",
    _2_00_3_00pm: "0",
    _3_00_4_00pm: "0",
    _4_00_5_00pm: "0",
    _5_00_6_00pm: "0",
    _6_00_7_00pm: "0",
    _7_00_8_00pm: "0",
    _8_00_9_00pm: "0",
    _9_00_10_00pm: "0",
    _10_00_11_00pm: "0",
    _11_00_12_00am: "0",
    ":id": "row-tbtv-n5nb.5km5",
    ":version": "rv-q93u-aikn-dvne",
    ":created_at": "2022-05-26T19:59:59.442Z",
    ":updated_at": "2022-05-26T19:59:59.442Z"
  },
  {
    id: "48",
    segmentid: "15741",
    roadway_name: "BAY ST",
    from: "CLINTON ST",
    to: "BALTIC ST",
    direction: "NB",
    date: "2012-01-14T00:00:00.000",
    _12_00_1_00_am: "113",
    _1_00_2_00am: "96",
    _2_00_3_00am: "62",
    _3_00_4_00am: "51",
    _4_00_5_00am: "66",
    _5_00_6_00am: "57",
    _6_00_7_00am: "77",
    _7_00_8_00am: "138",
    _8_00_9_00am: "183",
    _9_00_10_00am: "293",
    _10_00_11_00am: "0",
    _11_00_12_00pm: "0",
    ":id": "row-ni4v_x2qf.yd87",
    ":version": "rv-qhiz-mgrp-pv4y",
    ":created_at": "2022-05-26T19:59:59.442Z",
    ":updated_at": "2022-05-26T19:59:59.442Z"
  }
] as const

/**
 * MTA Open Data Catalog, https://data.ny.gov/d/f462-ka72. The second row is a
 * planned dataset with no URL yet. SODA3, captured 2026-11-01.
 */
export const mtaOpenDataCatalogRows = [
  {
    open_dataset_id: "kir5-i9xt",
    dataset_title: "MTA Subway Rolling Stock",
    type: "dataset",
    agency: "New York City Transit",
    posting_frequency: "Monthly",
    description: "An inventory of active and retired NYCT subway rolling stock.",
    status: "PUBLISHED",
    dataset_created_at: "2025-12-17T19:46:28.000",
    plan_submission_date: "COMPLETE",
    nys_url: {
      url: "https://data.ny.gov/d/kir5-i9xt"
    },
    ":id": "row-zu92.2nrt~bcsc",
    ":version": "rv-84gd-kzv9_37zf",
    ":created_at": "2026-11-01T04:31:43.985Z",
    ":updated_at": "2026-11-01T04:31:43.985Z"
  },
  {
    open_dataset_id: "11",
    dataset_title: "MTA Subway Station Depth",
    status: "Planned",
    plan_submission_date: "Q4 2026",
    ":id": "row-idwc_97g9~yizm",
    ":version": "rv-x6n7_cw89-h39v",
    ":created_at": "2026-11-01T04:31:43.985Z",
    ":updated_at": "2026-11-01T04:31:43.985Z"
  }
] as const

/**
 * SODA3 `count(*) AS count` of the Traffic Speeds rows in Queens, captured
 * 2026-11-01. The count is text, like every number in Socrata rows.
 */
export const trafficSpeedQueensCount = [{ count: "33539349" }] as const

/** SODA3 `count(*) AS count` of every Traffic Speeds row, captured 2026-11-01. */
export const trafficSpeedCount = [{ count: "113269686" }] as const

/**
 * SODA3 `export.csv` of the two `trafficSpeedRows`, captured 2026-11-01. The
 * header row holds display names and timestamps are written for people. Asked
 * for `Range: bytes=0-63`, SODA3 sent this whole file with a 200.
 */
export const trafficSpeedCsv =
  '"ID","SPEED","TRAVEL_TIME","STATUS","DATA_AS_OF","LINK_ID","LINK_POINTS","ENCODED_POLY_LINE","ENCODED_POLY_LINE_LVLS","OWNER","TRANSCOM_ID","BOROUGH","LINK_NAME"\n"385","58.4","24","0","2026 Oct 26 10:48:03 PM","4616208","40.6077805,-74.14091 40.60826,-74.132101","sezvFtsocM_Bav@","BB","NYC_DOT_LIC","4616208","Staten Island","SIE W BRADLEY AVENUE - WOOLEY AVENUE"\n"385","57.78","24","0","2026 Oct 26 10:58:04 PM","4616208","40.6077805,-74.14091 40.60826,-74.132101","sezvFtsocM_Bav@","BB","NYC_DOT_LIC","4616208","Staten Island","SIE W BRADLEY AVENUE - WOOLEY AVENUE"\n'

/** https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene.json */
export const elevatorOutageRows = [
  {
    station: "Queensboro Plaza",
    borough: "",
    trainno: "N/W/7",
    equipment: "EL478",
    equipmenttype: "EL",
    serving: "Street to mezzanine",
    ADA: "Y",
    outagedate: "11/27/2026 10:00:00 PM",
    estimatedreturntoservice: "11/28/2026 06:00:00 AM",
    reason: "Inspection",
    isupcomingoutage: "Y",
    ismaintenanceoutage: "N"
  },
  {
    station: "Queensboro Plaza",
    borough: "",
    trainno: "N/W/7",
    equipment: "EL478",
    equipmenttype: "EL",
    serving: "Street to mezzanine",
    ADA: "Y",
    outagedate: "10/29/2026 10:00:00 PM",
    estimatedreturntoservice: "10/30/2026 06:00:00 AM",
    reason: "Maintenance",
    isupcomingoutage: "Y",
    ismaintenanceoutage: "N"
  }
] as const

/** https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene_equipments.json */
export const elevatorEquipmentRows = [
  {
    station: "125 St",
    borough: "",
    trainno: "1",
    equipmentno: "ES103",
    equipmenttype: "ES",
    serving: "125 St & Broadway (SE corner) to mezzanine",
    ADA: "N",
    isactive: "Y",
    nonNYCT: "N",
    shortdescription: "Street to mezzanine",
    linesservedbyelevator: "1",
    elevatorsgtfsstopid: "116",
    elevatormrn: "306",
    stationcomplexid: "306",
    nextadanorth: "",
    nextadasouth: "",
    redundant: 0,
    busconnections: "",
    alternativeroute: ""
  }
] as const

/** Discovery API search for i4gi-tjb9 on data.cityofnewyork.us. */
export const catalogSearchResponse = {
  results: [
    {
      resource: {
        name: "DOT Traffic Speeds",
        id: "i4gi-tjb9",
        resource_name: null,
        parent_fxf: [],
        description: "",
        attribution: null,
        attribution_link: null,
        contact_email: null,
        type: "dataset",
        updatedAt: "2026-10-27T11:30:15.000Z",
        createdAt: "2017-04-17T18:31:04.000Z",
        metadata_updated_at: "2026-03-23T14:35:10.000Z",
        data_updated_at: "2026-10-27T11:30:15.000Z",
        page_views: {
          page_views_last_week: 758,
          page_views_last_month: 3189,
          page_views_total: 49189,
          page_views_last_week_log: 9.567956075415466,
          page_views_last_month_log: 11.639340708652233,
          page_views_total_log: 15.58607743461069
        },
        columns_name: [
          "ID",
          "BOROUGH",
          "TRANSCOM_ID",
          "LINK_NAME",
          "SPEED",
          "DATA_AS_OF",
          "ENCODED_POLY_LINE_LVLS",
          "STATUS",
          "ENCODED_POLY_LINE",
          "TRAVEL_TIME",
          "LINK_ID",
          "OWNER",
          "LINK_POINTS"
        ],
        columns_field_name: [
          "id",
          "borough",
          "transcom_id",
          "link_name",
          "speed",
          "data_as_of",
          "encoded_poly_line_lvls",
          "status",
          "encoded_poly_line",
          "travel_time",
          "link_id",
          "owner",
          "link_points"
        ],
        columns_datatype: [
          "Text",
          "Text",
          "Text",
          "Text",
          "Text",
          "Calendar date",
          "Text",
          "Text",
          "Text",
          "Text",
          "Text",
          "Text",
          "Text"
        ],
        columns_description: ["", "", "", "", "", "", "", "", "", "", "", "", ""],
        columns_format: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
        download_count: 10268,
        provenance: "official",
        lens_view_type: "tabular",
        lens_display_type: "table",
        locked: false,
        backend: "nbe",
        blob_mime_type: null,
        hide_from_data_json: false,
        publication_date: "2017-04-27T18:05:28.000Z"
      },
      classification: {
        categories: [],
        tags: [],
        domain_category: "Transportation",
        domain_tags: [],
        domain_metadata: [
          {
            key: "Update_Automation",
            value: "Yes"
          },
          {
            key: "Update_Date-Made-Public",
            value: "7/13/2017"
          },
          {
            key: "Update_Update-Frequency",
            value: "Daily"
          },
          {
            key: "Update_Data-Change-Frequency",
            value: "Several times per minute each day"
          },
          {
            key: "Dataset-Information_Agency",
            value: "Department of Transportation (DOT)"
          }
        ]
      },
      metadata: {
        domain: "data.cityofnewyork.us"
      },
      permalink: "https://data.cityofnewyork.us/d/i4gi-tjb9",
      link: "https://data.cityofnewyork.us/Transportation/DOT-Traffic-Speeds/i4gi-tjb9",
      owner: {
        id: "5fuc-pqz2",
        user_type: "interactive",
        display_name: "NYC OpenData"
      },
      creator: {
        id: "5fuc-pqz2",
        user_type: "interactive",
        display_name: "NYC OpenData"
      }
    }
  ],
  resultSetSize: 1,
  timings: {
    serviceMillis: 26,
    searchMillis: [15, 4]
  },
  warnings: []
} as const

/** SODA3 query without an app token: HTTP 403. */
export const soda3AuthenticationRequired = {
  code: "authentication_required",
  error: true,
  message: "This request must be authenticated or have an application token"
} as const

/** SODA3 query with an app token Socrata does not know: HTTP 403, captured 2026-11-01. */
export const soda3InvalidAppToken = {
  code: "permission_denied",
  error: true,
  message: "Invalid app_token specified"
} as const

/** SODA3 query naming a column the dataset lacks: HTTP 400, captured 2026-11-01. */
export const soda3NoSuchColumn = {
  code: "soql.analyzer.typechecker.no-such-column",
  error: true,
  message: "No such column `no_such_column'",
  status: 400,
  data: {
    name: "no_such_column"
  },
  source: {
    position: {
      column: 16,
      row: 1,
      text: "SELECT * WHERE `no_such_column` = 'x' LIMIT 1"
    },
    type: "anonymous"
  }
} as const

/** SODA3 `export.json` or `export.geojson`: HTTP 406 on every dataset tried, captured 2026-11-01. */
export const soda3ExportTypeUnavailable = {
  code: "unacceptable_response_type",
  error: true,
  message: "Requested type is not available"
} as const

/** SODA3 query with `page` and `orderingSpecifier: "discard"`: HTTP 400, captured 2026-11-01. */
export const soda3DiscardWithPaging = {
  code: "invalid_request",
  error: true,
  message: "Cannot discard ordering and use paging"
} as const

/** Discovery search on an unknown domain: HTTP 404. */
export const discoveryDomainNotFound = { error: "Domain not found: not-a-domain.example" } as const

/** Discovery search for an id the domain does not have (zzzz-zzzz): HTTP 200, captured 2026-11-01. */
export const discoveryNoResults = {
  results: [],
  resultSetSize: 0,
  timings: { serviceMillis: 24, searchMillis: [16, 2] },
  warnings: []
} as const

const bytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

/**
 * Staten Island Railway trip updates, nyct%2Fgtfs-si: the header and first three
 * entities (two trip updates and a vehicle), re-encoded with gtfs-realtime-bindings.
 */
export const statenIslandRailwayFeed = bytes(
  "CiEKAzEuMBiAsILXBso+EwoDMS4wEgwKAlNJEgYQkMyC1wYScAoIMDAwMDAxU0kaZAo/Cg4wNDY1MDBfU0kuTjI4UhIIMDc6NDY6NDQaCDIwMjYxMDI3KgJTU8o+FAoQMVNTIDA3NDUgVE5WL1NURxABEiESBhDqwILXBhoGEOrAgtcGIgRTMzFOOAfKPgYKATkSATkSXQoIMDAwMDAyU0kiUQo/Cg4wNDY1MDBfU0kuTjI4UhIIMDc6NDY6NDQaCDIwMjYxMDI3KgJTU8o+FAoQMVNTIDA3NDUgVE5WL1NURxABGAsgASimqYLXBjoEUzIyThKWAQoIMDAwMDAzU0kaiQEKPwoOMDQ4MDAwX1NJLk4yOFISCDA4OjAwOjQzGggyMDI2MTAyNyoCU1PKPhQKEDFTUyAwODAwIFROVi9TVEcQARIjEgYQtrCC1wYaBhC2sILXBiIEUzIyTjgHyj4ICgIwMRICMDESIRIGEOrAgtcGGgYQ6sCC1wYiBFMzMU44B8o+BgoBNhIBNg=="
)

/** LIRR alerts, camsys%2Flirr-alerts: the header and first alert, re-encoded. */
export const lirrAlertsFeed = bytes(
  "ChUKAzIuMBAAGKKegtcGyj4FCgMxLjASoAMKE2xtbTphbGVydDoyNzM2NDk6MjQqiAMKDAjch4LXBhDwnoLXBioTCgJMSRIBNso+CQoHTEk6NjoyNCojCgJMSSIdCgxHTzIwMl8yNl84MTIaCjIwMjYtMTAtMjcqATZSnwIKfgp4VGhlIDY6MzlhbSB0cmFpbiBmcm9tIFBlbm4gU3RhdGlvbiB0byBMb25nIEJlYWNoIGlzIG9wZXJhdGluZyAxMC0xNSBtaW51dGVzIGxhdGUgZHVlIHRvIHNpZ25hbCB0cm91YmxlIHdlc3Qgb2YgV29vZHNpZGUuEgJlbgqcAQqQATxwPlRoZSA8c3Ryb25nPjY6MzlhbSB0cmFpbiBmcm9tIFBlbm4gU3RhdGlvbiB0byBMb25nIEJlYWNoPC9zdHJvbmc+IGlzIG9wZXJhdGluZyAxMC0xNSBtaW51dGVzIGxhdGUgZHVlIHRvIHNpZ25hbCB0cm91YmxlIHdlc3Qgb2YgV29vZHNpZGUuPC9wPhIHZW4taHRtbMo+Gwjch4LXBhDch4LXBhoLU29tZSBEZWxheXM4AA=="
)

/**
 * A GTFS-realtime path with no feed behind it, nyct%2Fgtfs-missing: HTTP 200 with
 * `content-type: application/xml`, captured 2026-11-01. S3's error passes as a success.
 */
export const mtaFeedNoSuchKey =
  '<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message><Key>nyct/gtfs-missing</Key><RequestId>AYP5K862HRD1J2DQ</RequestId><HostId>eRB436e4EXuxOlkq9iWclgkby0K0fvdYztdKhR8deywYdvK2Y4TbX76EU/FBXD0CPYjBzB3m8lDiDADhqvlJWcpEEtIr0HbR</HostId></Error>'

/** MTA's API gateway on a route it does not serve: HTTP 403, captured 2026-11-01. */
export const mtaGatewayForbidden = { message: "Forbidden" } as const

/** A key the GTFS static bucket does not have, gtfs_missing.zip: HTTP 403, captured 2026-11-01. */
export const gtfsStaticAccessDenied =
  '<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>AccessDenied</Code><Message>Access Denied</Message><RequestId>AYP29MH7J3CKS2DY</RequestId><HostId>TvDjcAUSARHNKYgwe7uDe1LpKCECLyXDEmzbrMVqcbt0jtuomCaVKjtVBKbeiHDU5DdFxjIUF7c=</HostId></Error>'

/** Headers of `HEAD gtfs_si.zip`, captured 2026-11-01. */
export const gtfsStaticHeadHeaders = {
  "content-type": "application/zip",
  "content-length": "6406562",
  "last-modified": "Fri, 16 Oct 2026 15:14:44 GMT",
  etag: '"0f957f2ae9e9e0001e8d33d2a5c2149c"'
} as const

/** The first 64 bytes of gtfs_si.zip, the answer to `Range: bytes=0-63`, captured 2026-11-01. */
export const gtfsStaticZipStart = bytes(
  "UEsDBBQAAAAIAAAAIQDvqqe6fwAAAKUAAAAKAAAAYWdlbmN5LnR4dDzLsQrCQAyA4V3wHfIAobe7lc463dKphA=="
)

/** Bus Time vehicle monitoring without a key: HTTP 401, captured 2026-11-01. */
export const busTimeKeyRequired = {
  Siri: {
    ServiceDelivery: {
      ResponseTimestamp: "2026-11-01T12:33:36.214-05:00",
      VehicleMonitoringDelivery: [
        {
          ResponseTimestamp: "2026-11-01T12:33:36.214-05:00",
          ErrorCondition: {
            OtherError: { ErrorText: "API key required." },
            Description: "API key required."
          }
        }
      ]
    }
  }
} as const
