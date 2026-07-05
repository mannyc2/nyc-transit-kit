# @nyc-transit-kit/compat

Promise facade over the Effect-native `nyc-transit-kit` packages.

Use this package when an application wants Promise-returning functions without
owning an Effect runtime directly. The wrappers delegate to the native packages
for endpoint construction, retries, schemas, and provider logic.

## Import Paths

```ts
import { queryNycDotRows } from "@nyc-transit-kit/compat/nyc-dot"
import { isTransitKitCompatError } from "@nyc-transit-kit/compat/errors"
```

Promise wrappers reject with the same typed errors as the underlying Effect
programs. TypeScript does not type Promise rejection channels, so use the error
guards when callers need to narrow failures.

## Compatibility

Each `nyc-transit-kit` release pins one exact Effect 4 beta. Match the Effect
version documented in `docs/getting-started.md` to avoid duplicate Effect
copies in a downstream lockfile.
