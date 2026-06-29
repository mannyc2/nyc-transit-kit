# Provider Coverage

This document defines what "complete coverage" means for `nyc-transit-kit`.
It separates generic access from curated descriptors and typed adapters so the
release promise stays useful without turning the repository into a full catalog
mirror.

## Coverage Types

- **Generic coverage**: a user can reach a provider API surface by supplying an
  id, URL, query, or feed descriptor. For Socrata-backed data, SODA3
  query/export/catalog works for any supported public dataset id on the
  configured domain.
- **Curated descriptor coverage**: the repo ships provider-owned descriptors
  with stable ids, names, descriptions, and lookup helpers.
- **Descriptor metadata**: curated descriptors may include `sourceUrl`, `tags`,
  `temporalFields`, `adapterStatus`, and `lastVerified` to document provenance,
  discoverability, known temporal columns, adapter depth, and local verification
  date.
- **Typed adapter coverage**: the repo ships row schemas or normalized response
  schemas for a specific dataset or API.
- **Direct feed coverage**: the repo ships descriptors for official non-Socrata
  feeds such as MTA GTFS static and GTFS Realtime endpoints.
- **Complete provider coverage**: every official surface in the chosen scope has
  at least generic or direct feed coverage, and every curated scope has an
  offline coverage check that reports missing and extra entries.

## v0 Matrix

| Provider family | Generic coverage | Curated descriptors | Typed adapters | Direct feeds |
| --- | --- | --- | --- | --- |
| SODA3 | yes | no | response fragments only | no |
| NYC Open Data | yes | policy-scoped | selected | no |
| NYC DOT | via NYC Open Data | DOT-scoped | selected | no |
| MTA Open Data | via data.ny.gov | MTA catalog | selected | no |
| MTA Direct | URL/feed-based | feed descriptors | GTFS-RT summary and selected JSON rows | yes |

## v0 Scope

- `soda3`: generic coverage for any public Socrata SODA3 dataset on a caller
  supplied domain.
- `nyc-open-data`: generic coverage for `data.cityofnewyork.us`; curated
  descriptors only for transit, transportation, or provider-family datasets
  selected by policy.
- `nyc-dot`: curated descriptor coverage for DOT datasets surfaced through NYC
  Open Data or DOT's official data page.
- `mta-open-data`: curated descriptor coverage for published MTA Open Data
  Catalog entries with real four-by-four Socrata ids.
- `mta-direct`: direct feed coverage for official MTA GTFS static, GTFS-RT,
  service alert, elevator/escalator, and Bus Time surfaces. Typed adapters can
  lag behind direct feed descriptors.

## Curated Scope

The first complete curated scope is:

1. MTA Open Data: all rows from `f462-ka72` where the dataset is published and
   the Open Dataset ID is a real Socrata four-by-four id.
2. NYC DOT: all datasets attributable to Department of Transportation from NYC
   Open Data, plus DOT data page items that resolve to Socrata datasets.
3. NYC Open Data: generic full-domain access, with curated descriptors only for
   transit or transportation datasets that are not already owned by DOT or MTA
   provider packages.

Source counts are not hand-maintained in docs. Use
`scripts/check-provider-coverage.ts` with local official-source snapshots; its
JSON output is the source of truth for `expectedCount`, `localCount`,
`missingIds`, and `extraIds`.

Descriptor metadata does not replace the offline coverage check. It documents
the curated local record and is preserved by
`scripts/update-descriptor-records.ts` when present in input records.

```sh
bun run scripts/check-provider-coverage.ts --provider nyc-dot --input ./tmp/dot-source.json
```

Supported providers are `nyc-open-data`, `nyc-dot`, `mta-open-data`, and
`mta-direct`. For `mta-direct`, pass a normalized offline snapshot of direct
feed objects with `id` and `url` fields; the check compares IDs only. The
script is offline by default, never contacts provider endpoints, and does not
validate direct-feed endpoint liveness.

## Selected Adapter Policy

Generic access remains broad. Typed adapters are curated and should land only
when a tiny public or synthetic fixture proves the provider DTO shape.

The first MTA Open Data typed adapter decodes MTA Open Data Catalog rows from
dataset `f462-ka72`. The first MTA JSON direct typed adapter decodes rows from
the elevator/escalator current JSON feed. These adapters are row-schema depth;
they do not normalize outage severity, reliability, route impact, scores, or
other downstream product meaning.

Descriptor `adapterStatus` values must match the implemented depth:

- `"none"` means no package decoder exists.
- `"row-schema"` means the package validates source DTO rows or row arrays.
- `"normalized"` is reserved for deliberate provider-independent DTOs.

## Release Ritual

Provider coverage release evidence is generated from local official-source
snapshots. Keep snapshots outside version control, for example under
`./tmp/provider-snapshots`, and create a manifest like this:

```json
{
  "providers": [
    {
      "provider": "mta-direct",
      "input": "./tmp/provider-snapshots/mta-direct.json"
    },
    {
      "provider": "nyc-dot",
      "input": "./tmp/provider-snapshots/nyc-dot.json"
    }
  ]
}
```

Run the set-level checker:

```sh
bun run check:provider-coverage -- --manifest ./tmp/provider-snapshots/manifest.json --out .release/evidence/provider-coverage.json
```

The evidence file reports one entry per provider:

- `missingIds`: official snapshot IDs not represented locally.
- `extraIds`: local curated IDs not present in the snapshot.
- `ok`: `true` only when both arrays are empty.

The snapshots are evidence inputs, not committed source of truth. Review
`.release/evidence/provider-coverage.json` whenever curated provider scopes
change.

## Rejected For v0

Curating 100% of all NYC Open Data datasets as source constants is not the v0
default. That would turn this toolkit into a citywide catalog mirror. The v0
release target is 100% generic access for supported Socrata domains, targeted
curated descriptor coverage for transit/provider families, and offline coverage
checks for every curated scope.
