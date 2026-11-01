# @nyc-transit-kit/cli

`ntk`, a Bun CLI for official NYC and MTA transit data.

```sh
bun add -d @nyc-transit-kit/cli
export SOCRATA_APP_TOKEN=...

bunx ntk nyc-dot dataset query --name traffic-speeds --select "link_name, speed LIMIT 5"
bunx ntk mta gtfs-rt probe --feed subway-ace --json
bunx ntk mta elevator-escalator --feed elevator-escalator-current --json
```

- `--json` writes exactly one envelope, `{ ok, data | error, meta }`, to stdout,
  `--help` included. Readable output is not a contract.
- `--dry-run` prints the requests a command would send, with the token
  redacted. It sends nothing and writes nothing.
- `SOCRATA_APP_TOKEN` is the default for `--app-token`. SODA3 query and export
  refuse requests without one.
- Downloads are written beside their destination and renamed, so a failed run
  leaves no file.

The npm package needs Bun at runtime. GitHub releases also carry a compiled
`ntk` binary that needs nothing installed.

See the [command and error-code reference](https://github.com/mannyc2/nyc-transit-kit/blob/main/docs/api-reference.md#cli).
