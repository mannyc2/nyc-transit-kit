# @nyc-transit-kit/cli

Bun CLI for inspecting official NYC and MTA transit data through
`nyc-transit-kit`.

## Runtime

The published CLI bin is a Bun-shebang wrapper. Install with Bun and run with
`bunx`:

```sh
bun add -d @nyc-transit-kit/cli
bunx ntk --version --json
```

Every command supports `--help`; commands that produce machine-readable output
support `--json`.

## Configuration

`SOCRATA_APP_TOKEN` is optional and used only by CLI Socrata-backed requests.
Core library packages receive app tokens through explicit config instead of
reading environment variables.

## Docs

See the repository README, `docs/getting-started.md`, and
`docs/api-reference.md` for the full command and package surface.
