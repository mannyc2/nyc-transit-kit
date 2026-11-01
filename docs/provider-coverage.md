# Provider Coverage

What the kit reaches, what it curates, and how the curated lists are checked
against the providers' own catalogs.

## Coverage Types

- **Generic coverage**: any public dataset by domain and id.
  `@nyc-transit-kit/soda3` queries, exports and searches every public SODA3
  dataset on any Socrata domain, and so do the CLI's `socrata` and `catalog`
  commands.
- **Curated datasets**: a provider package names a dataset and ships the schema
  of its rows, as a `Dataset<Row>`. Queries decode rows against it.
- **Direct feeds**: official feeds outside Socrata, by name: GTFS static zips,
  GTFS-realtime, elevator and escalator JSON, and Bus Time.
- **Typed rows**: the schemas behind curated datasets and JSON feeds, each
  checked against real responses in `@nyc-transit-kit/fixtures`. They describe
  the provider's own columns and add no meaning of their own: no severity,
  reliability, route impact or scores.

## Matrix

| Provider | Generic | Curated | Typed rows | Direct feeds |
| --- | --- | --- | --- | --- |
| Any Socrata domain | SODA3 query and export, Discovery search | none | catalog results, error bodies | none |
| NYC Open Data, `data.cityofnewyork.us` | yes | none outside DOT | none | none |
| NYC DOT | through NYC Open Data | bus lanes, traffic speeds, traffic volume counts | all three | none |
| MTA Open Data, `data.ny.gov` | yes | the MTA Open Data Catalog | the catalog's rows | none |
| MTA direct | by feed name or URL | GTFS static, GTFS-realtime, elevator and escalator, and Bus Time feeds | FeedMessage summaries, elevator outages and equipment | yes |

## Curated Scope

The curated scope the kit aims at:

1. MTA Open Data: every published row of the MTA Open Data Catalog
   (`f462-ka72`) with a real Socrata id.
2. NYC DOT: every NYC Open Data dataset attributed to the Department of
   Transportation.
3. NYC Open Data: transit and transportation datasets that DOT or the MTA do
   not already own.

0.3.0 curates far less than that: the MTA catalog itself and three DOT
datasets. Generic access reaches the rest. The coverage check reports the gap
as `missingIds`. Counts are never kept by hand in docs.

A dataset joins a curated list only with its row schema and a real sample in
`@nyc-transit-kit/fixtures` that the schema decodes.

## Checking Coverage

`scripts/check-provider-coverage.ts` compares a local snapshot of a provider's
official list with the kit's list. It is offline: it never contacts a provider
and does not check that feeds are live.

```sh
bun run scripts/check-provider-coverage.ts --provider nyc-dot --input ./tmp/dot-source.json
```

Providers are `nyc-open-data`, `nyc-dot`, `mta-open-data` and `mta-direct`. A
Socrata snapshot can be Discovery results or catalog rows; ids are read from
`resource.id`, `id`, `open_dataset_id` and similar fields, and anything that is
not a four-by-four Socrata id, such as a planned MTA dataset's number, is
skipped. For `mta-direct`, pass feed objects with `id` and `url`. Only ids are
compared.

## Release Ritual

Release evidence comes from local snapshots of the official sources. Keep the
snapshots out of version control, for example under `./tmp/provider-snapshots`,
and list them in a manifest:

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

Run the set-level check:

```sh
bun run check:provider-coverage -- --manifest ./tmp/provider-snapshots/manifest.json --out .release/evidence/provider-coverage.json
```

The evidence file has one entry per provider:

- `missingIds`: ids in the snapshot that the kit does not curate.
- `extraIds`: ids the kit curates that the snapshot lacks.
- `ok`: `true` only when both lists are empty.

Review `.release/evidence/provider-coverage.json` whenever a curated list
changes.

## Rejected For v0

Curating every NYC Open Data dataset as source constants. That would turn the
kit into a citywide catalog mirror. The target is generic access to every
supported Socrata domain, curated datasets for transit and provider families,
and an offline coverage check for every curated scope.
