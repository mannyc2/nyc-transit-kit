# Release Plan

The planned first public release version is `0.1.0`. The package release
version is separate from the CLI/schema contract version exposed as
`schemaVersion`.

No npm publication or binary distribution runs automatically for v0. Publication
must be preceded by local checks, GitHub CI, a manual release dry-run, and a
reviewed `ts-release` plan.

Before any release:

- `bun install`
- `bun run release:version:check`
- `bun run check`
- `bun run build:cli`
- `./dist/ntk --version --json`
- `bun run release:prepare:npm`
- `bun run check:npm-stage`
- `bun run check:release-config`
- `bun run release:plan`
- validate `./dist/ntk-release-manifest.json` against `CliReleaseManifest`

Package archive checks must prove that archives do not contain workspace-private
dependencies, `file:` dependencies, `node_modules`, `.env`, private absolute
paths, source maps with local paths, or unrelated repository artifacts. Source
manifests may use Bun `catalog:` references for approved third-party
dependencies, but `bun pm pack` output must prove packed `package.json`
dependency specs have been resolved to normal version strings and contain no
`workspace:`, `catalog:`, `file:`, local path specs, or private absolute paths.

`packages/contracts/src/release.ts` owns the `CliReleaseManifest` schema. The
local binary build writes `dist/ntk-release-manifest.json`; future release
automation must keep validating that file before publication.

## Version Sync

The root package version is the release version source of truth. Run:

```sh
bun run release:version
bun install
```

when changing release versions. The sync script updates package manifest
versions, internal `@nyc-transit-kit/*` dependency specs, and the shared
`releaseVersion` constant. `bun run release:version:check` must pass before
release staging or publication.

## NPM Staging

Workspace package manifests stay Bun-first and source-first for development.
Release automation publishes staged packages, not raw workspace package
directories.

```sh
bun run release:prepare:npm
bun run check:npm-stage
```

`release:prepare:npm` creates npm-ready package directories under
`.release/npm/<package>` and package tarballs under `.release/artifacts`.
Staged manifests use literal release versions and normal semver dependency
specs; they must not contain `workspace:`, `catalog:`, `file:`, local absolute
paths, `.env` files, or private artifacts.

The CLI npm package is Bun-runtime based and stages `bin/ntk` plus
`bin/nyc-transit` wrappers with a Bun shebang. The compiled `dist/ntk` binary is
the no-runtime executable artifact for GitHub Releases.

## ts-release

`ts-release` is root-only release orchestration. The repo installs the published
`@mannyc1/ts-release` package as a root dev dependency; it is not a dependency
of any publishable `@nyc-transit-kit/*` package. GitHub release workflows use
the bundled `ts-release` action from `mannyc2/ts-release/apps/ts-release-action`
pinned to a commit. Switch that pin to a stable action tag once the action has
one.

The standard release commands call `scripts/run-ts-release.ts`, a small Bun
adapter over the published `@mannyc1/ts-release/workflows` API:

```sh
bun run release:plan
```

Do not commit local `ts-release` paths, `file:` dependencies, token values, or
private absolute paths. If dogfooding a local `ts-release` checkout, keep that
wiring outside committed manifests and restore the published package dependency
before release-flow changes land.

`release:plan` is safe: it renders the release plan and does not publish.
`release:validate` requires the npm CLI and `GH_TOKEN` for the GitHub release
target. For local releases, authenticate GitHub however you prefer; if using
`gh`, export the token explicitly:

```sh
gh auth login
gh auth status
export GH_TOKEN="$(gh auth token)"
```

In GitHub Actions, pass the built-in workflow token to `gh` as
`GH_TOKEN: ${{ github.token }}` and grant `contents: write` for jobs that create
releases. Actual publish requires an approved workflow/action command that
forwards explicit irreversible-operation approval:

```sh
bun run release:run --execute --approve-irreversible
```

The v0 GitHub release target is configured as a draft release first.

## NPM Publish Auth

The first `0.1.0` publication is a bootstrap publish because the
`@nyc-transit-kit/*` packages do not exist on npm yet. npm trusted publishing
relationships can only be configured for packages that already exist, so the
initial publish uses an npm account session or granular access token with 2FA
bypass. After the packages exist, configure npm trusted publishing for each
package and move the npm targets from `tokenEnv` to `trustedPublishing`.

Before bootstrap publishing, create the npm organization named
`nyc-transit-kit` under the publishing npm account and choose the free public
package plan. npm uses the organization name as the package scope, and
`npm publish --access public` fails with `E404 Scope not found` until that
scope exists and the publishing account/token can write to it.

For token-backed bootstrap publishing, make sure the token is wired into npm
itself, not only exported as `NPM_TOKEN`. Locally that can be a private `.npmrc`
entry such as:

```sh
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

In GitHub Actions, `actions/setup-node` can create a user `.npmrc`. Before the
release config is switched to trusted publishing, token-backed workflows must
also make `NPM_TOKEN` available to `ts-release` child npm commands. During token
bootstrap, pass both `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` and
`NPM_TOKEN: ${{ secrets.NPM_TOKEN }}`.

Once the first package versions exist, configure trusted publishing for each
package through npmjs.com or `npm trust`. The trusted publisher must match:

- owner: `mannyc2`
- repository: `nyc-transit-kit`
- workflow filename: `release.yml`
- allowed action: `npm publish`

With npm 11.15.0 or newer, the CLI form is:

```sh
for package in cli compat contracts fixtures mta nyc-dot nyc-open-data soda3; do
  npm trust github "@nyc-transit-kit/${package}" \
    --file release.yml \
    --repository mannyc2/nyc-transit-kit \
    --allow-publish \
    --yes
done
```

`npm trust` requires package write access, account-level 2FA, and an auth method
accepted by npm trust endpoints. Granular access tokens with the bypass-2FA
option can publish packages but cannot manage trusted-publisher relationships.

Then run:

```sh
bun run release:trust-publishing
```

That command verifies all `@nyc-transit-kit/*` packages are visible on npm
before rewriting npm targets from `tokenEnv` to `trustedPublishing`. The
trusted publishing workflow must run on a GitHub-hosted runner with Node 24,
npm 11.5.1 or newer, and:

```yaml
permissions:
  contents: read
  id-token: write
```

The `Release` workflow in `.github/workflows/release.yml` runs on pushes to
`main` and on manual dispatch. It checks remote npm/GitHub state first, skips
when the configured version already exists, and executes only when every npm
package plus the GitHub release tag is missing. The execute job uses GitHub OIDC
instead of `NPM_TOKEN`; it needs `id-token: write` for npm trusted publishing
and `contents: write` for the GitHub release. Trusted publishing requires Node
22.14.0 or newer and npm 11.5.1 or newer. `npm whoami` does not validate OIDC
auth because npm performs the token exchange during `npm publish`.

## GitHub Runbook

1. Run local checks:
   `bun install`, `bun run check`, `bun run build:cli`,
   `./dist/ntk --version --json`, `bun run release:prepare:npm`,
   `bun run check:npm-stage`, `bun run check:release-config`, and
   `bun run release:plan`.
2. When curated provider scopes changed, collect local provider snapshots under
   `./tmp/provider-snapshots`, run
   `bun run check:provider-coverage -- --manifest ./tmp/provider-snapshots/manifest.json --out .release/evidence/provider-coverage.json`,
   and review `.release/evidence/provider-coverage.json` before release plan
   review. The snapshots are local evidence inputs and are not committed source
   of truth.
3. Open a PR and wait for default CI to pass.
4. Run the GitHub `Release Plan` workflow or review the plan artifact from the
   `Release` workflow. Review `.release/evidence`, `.release/artifacts`, and
   `dist`.
5. For the first publish only, create the `nyc-transit-kit` npm organization and
   publish with an npm account session or `NPM_TOKEN`. Skip this step when the
   package versions already exist on npm.
6. After packages exist, configure npm trusted publishing for each package, run
   `bun run release:trust-publishing`, and review the resulting config change.
7. Review the rendered `ts-release` plan. Confirm every npm target points at
   `.release/npm/<package>`, has the matching `@nyc-transit-kit/*`
   `packageName`, and the GitHub target creates a draft release.
8. Publish by merging the release/version change to `main` or manually running
   `Release` on `main`. Configure the GitHub `release` environment with required
   reviewers if execution should wait for human approval before npm/GitHub
   publication.
9. Post-publish, verify npm and GitHub state:

```sh
npm view @nyc-transit-kit/contracts version
npm view @nyc-transit-kit/soda3 version
npm view @nyc-transit-kit/mta version
npm view @nyc-transit-kit/nyc-open-data version
npm view @nyc-transit-kit/nyc-dot version
npm view @nyc-transit-kit/cli version
npm view @nyc-transit-kit/compat version
npm view @nyc-transit-kit/fixtures version
gh release view v0.1.0 --repo mannyc2/nyc-transit-kit
```

Download the GitHub binary artifact and run `ntk --version --json`; it should
report the release version, schema version, source commit, and build target.
