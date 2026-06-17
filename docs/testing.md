# Testing Strategy

The default test runner is Bun's native `bun test`.

This is a deliberate repo rule: the spec requires Bun for package management,
scripts, tests, and binary compilation. Bun's official docs describe the test
runner as TypeScript-first, Jest-compatible, and configurable through
`bunfig.toml`.

## TDD Loop

1. Add or update a focused failing test.
2. Implement the smallest provider-family change that makes it pass.
3. Run the package test directly.
4. Run `bun run check` before widening the change.

## Default Test Scope

- Unit and architecture tests must use fixtures or injected services.
- Default tests must not require live network.
- Provider clients should inject fetch/config/time dependencies.
- CLI tests should validate `--json` envelopes through contract schemas.
- Architecture tests guard SODA3-only behavior, package boundaries, and env-read
  rules.

## Effect Test Guidance

The Effect skill prefers `@effect/vitest` for Vitest-based Effect tests. This
repo remains Bun-first unless that non-negotiable changes. Effect code should
still follow the skill's design guidance: typed errors, explicit services and
layers, schema validation at boundaries, and runtime execution only at
entrypoints.

## Effect Language Service

The root workspace installs `@effect/language-service` as developer tooling for
editor diagnostics, quick info, refactors, and build-time Effect diagnostics. It
is configured once in `tsconfig.base.json` so every package tsconfig inherits the
plugin.

Use the workspace TypeScript version in editors such as VS Code or Cursor. The
language service runs through the project TypeScript installation, not the
editor-bundled TypeScript.

`bun install` runs the root `prepare` script, which keeps `.repos/effect`
available for local Effect guidance and runs `effect-language-service patch` so
`tsc` emits Effect diagnostics during `bun run check:types`. The typecheck uses
a forced project-reference build so diagnostics are not skipped by stale
incremental `.tsbuildinfo` files.

`bun run check` also runs `bun run check:effect`, a project-wide
`effect-language-service diagnostics --project tsconfig.json` pass, so Effect
diagnostics are visible even outside an editor session.
