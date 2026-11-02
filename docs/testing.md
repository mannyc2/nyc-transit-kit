# Testing

Tests are `@effect/vitest`, run in Bun:

```sh
bun run test                                        # bun --bun vitest run
bun --bun vitest run packages/soda3/test/Soql.test.ts   # one file
bun run check                                       # tests plus the type, style and package gates
```

Each module's test sits beside its package as `test/<Module>.test.ts`;
`tests/architecture` and `tests/docs` hold the repository-wide checks.

## Rules

- **Effect code is tested with `it.effect`.** It supplies `TestClock` and
  `TestConsole`, so a test never waits on real time or writes to the terminal.
- **Real samples.** `@nyc-transit-kit/fixtures/Samples` holds responses captured
  from the providers, cut down, each with the date it was captured. Never
  hand-write one: a made-up row matches a made-up schema. When a provider
  changes shape, capture again.
- **Fakes refuse what the provider refuses.** `HttpTest.soda3` answers with
  Socrata's real 403 when `X-App-Token` is missing, so no test passes with a
  client that forgets the token. It also answers `export.json` and
  `export.geojson` with the 406 SODA3 sent for them, and paging with
  `orderingSpecifier: "discard"` with its 400. MTA tests answer a wrong feed
  path with the HTTP 200 XML the MTA really sends.
- **Test the real component.** `HttpTest.layer` replaces only the transport;
  the client code under test is the code that ships. The CLI test runs the real
  `Cli.run` with `Stdio.layerTest`, `TestConsole`, a `ConfigProvider` standing
  in for the environment and `HttpTest.layer` for the network, then decodes its
  stdout with `Envelope`.
- **Time is `TestClock`.** Backoff, `Retry-After` and capture timestamps are
  asserted by moving the clock, never by sleeping.
- **Keep harness state in the fake.** Read requests with `HttpTest.requests`,
  never from a module `let`.
- **Mutation-check each fix.** Undo the fix, watch its test fail, restore it. A
  test that passes both ways tests nothing.
- **No live network in tests.** Before a release, run the built binary against
  the providers by hand, and record what it taught you in the
  [official API map](official-api-map.md).

## Testing code that uses the kit

`HttpTest.layer(handler)` is an `HttpClient` that answers each request with
`handler` and records it. Provide it where your app provides
`FetchHttpClient.layer`, and layer your own retry policy over it as you would
in production. With `TestClock`, a test of that policy takes no time:

```ts
import { expect, it } from "@effect/vitest"
import * as HttpTest from "@nyc-transit-kit/fixtures/HttpTest"
import * as Samples from "@nyc-transit-kit/fixtures/Samples"
import * as GtfsRealtime from "@nyc-transit-kit/mta/GtfsRealtime"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as HttpClient from "effect/http/HttpClient"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as TestClock from "effect/testing/TestClock"

// The MTA answers 503 once, then sends the feed.
const flaky = () => {
  let calls = 0
  return HttpTest.layer(() =>
    ++calls === 1
      ? new Response(null, { status: 503 })
      : new Response(Samples.statenIslandRailwayFeed)
  )
}

// Your app's retry policy, over the test transport.
const Patient = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(
    HttpClient.HttpClient,
    HttpClient.retryTransient({ schedule: Schedule.spaced("1 second"), times: 1 })
  )
)

it.effect("retries a 503 one second later", () =>
  Effect.gen(function* () {
    const url = GtfsRealtime.feeds["staten-island-railway"].url
    const fiber = yield* Effect.forkChild(GtfsRealtime.fetchMessage(url))
    yield* TestClock.adjust("999 millis")
    expect(yield* HttpTest.requests).toHaveLength(1)
    yield* TestClock.adjust("1 millis")
    const message = yield* Fiber.join(fiber)
    expect(GtfsRealtime.summarize(message).entities).toBe(3)
    expect(yield* HttpTest.requests).toHaveLength(2)
  }).pipe(Effect.provide(Patient.pipe(Layer.provideMerge(flaky()))))
)
```

For SODA3, provide `Soda3Client.layer` over `HttpTest.soda3`, as in
[Getting started](getting-started.md#test-your-code-without-the-network).

## What `bun run check` runs

| Step | Guards |
| --- | --- |
| `check:types` | `tsc` over the whole repository, then the published sources alone under the strictest consumer settings (`tsconfig.published.json`): no Bun or Node types, `noPropertyAccessFromIndexSignature`, `isolatedModules`. |
| `check:effect` | Effect language-service diagnostics, strict. |
| `check:style` | Biome. |
| `test` | Package, CLI, architecture and docs tests. |
| `check:package` | Packed archives: no `workspace:`, `catalog:` or `file:` specs, no private paths. |

`tests/architecture` guards SODA3-only access, the apps and packages layout,
the package layering, PascalCase modules and their subpath exports, the design
guide's lint table, service key names, the release policy and the coverage
scripts. `tests/docs` checks that every export path is documented, that the
documented names exist, that every TypeScript block in the READMEs and `docs/`
compiles against the current code, and that every environment variable the CLI
reads is documented.

## Effect tooling

`bun install` runs `effect-language-service patch`, so `tsc` reports Effect
diagnostics. Point your editor at the workspace TypeScript to see them while
editing.
