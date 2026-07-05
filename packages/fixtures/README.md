# @nyc-transit-kit/fixtures

Tiny public or synthetic fixtures for deterministic tests.

Do not add full raw datasets, secrets, private data, or large provider exports.

Fixtures are exported from `src/index.ts` for direct test imports. Small
provider examples live as TypeScript constants unless a future fixture is
clearer as a committed file.

## Compatibility

This package has no runtime dependencies. Keep fixtures synthetic, public,
small, and provenance-noted.
