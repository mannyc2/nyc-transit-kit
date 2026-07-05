# @nyc-transit-kit/contracts

Shared `effect/Schema` contracts for `nyc-transit-kit`.

This package owns request, response, metadata, descriptor, CLI envelope, and
release manifest schemas used by the provider packages and CLI.

## Import Paths

```ts
import { Soda3QueryRequest } from "@nyc-transit-kit/contracts/soda3"
import * as Schema from "effect/Schema"

const decodeQuery = Schema.decodeUnknownEffect(Soda3QueryRequest)
```

Prefer narrow subpaths such as `@nyc-transit-kit/contracts/soda3`,
`@nyc-transit-kit/contracts/mta`, and `@nyc-transit-kit/contracts/cli` in
application and package code.

## Compatibility

Each release pins one exact Effect 4 beta. Keep consumer applications on the
same Effect version documented in `docs/getting-started.md`.
