# Release

A version is published to npm under `@nyc-transit-kit/*` when its version bump
merges to `main`. The package release version is separate from the CLI envelope
version exposed as `schemaVersion`.

0.3.0 moved to Effect 4.0.6 stable with `effect` as a peer dependency, moved
the CLI to `apps/cli`, and raised `schemaVersion` to `0.2.0`. It publishes five
packages: `soda3`, `mta`, `nyc-open-data`, `fixtures` and `cli`.
`@nyc-transit-kit/compat`, `@nyc-transit-kit/contracts` and
`@nyc-transit-kit/nyc-dot` left the workspace; their 0.2.0 versions stay
installable on npm until someone decides to deprecate them. Migration notes are
in `docs/getting-started.md`. 0.3.1 fixes the 0.3.0 CLI, which crashed when
installed fresh; see NPM Staging.

Releases run through `.github/workflows/release.yml` with `ts-release` and npm
trusted publishing. Publication must still be preceded by local checks, GitHub
CI, a release plan review, and the approved release workflow.

Before any release:

- `bun install`
- `bun run release:version:check`
- `bun run check`
- `bun run build:cli`
- `./dist/ntk --version --json`
- `bun run release:prepare:npm`
- `bun run check:npm-stage`
- `bun run check:release-config`
- `bun run check:release-ci`
- `bun run release:plan`
- validate `./dist/ntk-release-manifest.json` against `ReleaseManifest.ReleaseManifest`
- add the new version's row to the compatibility table in
  `docs/getting-started.md`

Package archive checks must prove that archives do not contain workspace-private
dependencies, `file:` dependencies, `node_modules`, `.env`, private absolute
paths, source maps with local paths, or unrelated repository artifacts. Source
manifests may use Bun `catalog:` references for approved third-party
dependencies, but `bun pm pack` output must prove packed `package.json`
dependency specs have been resolved to normal version strings and contain no
`workspace:`, `catalog:`, `file:`, local path specs, or private absolute paths.

`apps/cli/src/ReleaseManifest.ts` owns the release manifest schema. The
local binary build writes `dist/ntk-release-manifest.json`; future release
automation must keep validating that file before publication.

## Version Sync

The root package version is the release version source of truth. Run:

```sh
bun run release:version
bun install
```

when changing release versions. The sync script updates package manifest
versions, internal `@nyc-transit-kit/*` dependency specs, and the CLI's
`version` in `apps/cli/src/BuildInfo.ts`. `bun run release:version:check` must pass before
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
`.release/npm/<package>` (`.release/npm/cli`, `.release/npm/soda3` and so on) and
package tarballs under `.release/artifacts`.
Staged manifests use literal release versions and normal semver dependency
specs; they must not contain `workspace:`, `catalog:`, `file:`, local absolute
paths, `.env` files, or private artifacts.

The CLI npm package runs on Bun: its `ntk` and `nyc-transit` bins are
`src/bin.ts`, which starts with a Bun shebang. The compiled `dist/ntk` binary is
the no-runtime executable artifact for GitHub Releases.

The workspace lockfile pins every transitive version, but a user installing the
CLI gets whatever npm resolves that day. So `check:npm-stage` also installs the
staged CLI tarball outside the repository with no lockfile, the staged
libraries standing in for their unpublished versions, and runs
`ntk --version --json`. It fails if `ntk` does not start, if the install holds
two copies of `effect`, or if an installed package's `effect` peer range
rejects the one installed. 0.3.0 passed every other check and still crashed on
a fresh install: `@effect/platform-bun` 4.0.6 asks for
`@effect/platform-node-shared` `^4.0.6`, which resolved to 4.1.2, a version
built for Effect 4.1. The CLI has pinned `platform-node-shared` since 0.3.1.

## ts-release

`ts-release` is release orchestration, kept out of every publishable package.
It lives in `tools/release`, a standalone package with its own lockfile, pinned
to `@mannyc1/ts-release@0.0.7`. That version is built on Effect
`4.0.0-beta.83` and crashes when its layers are mixed with Effect 4.0.6, so
`tools/release` keeps the runner on `effect@4.0.0-beta.92` and pins
`@effect/platform-node-shared` to the same beta through `overrides`. The root
`prepare` script installs it, so `bun install` at the root covers it locally and
in CI. Moving to `ts-release` 0.4, which peers Effect 4.0, retires the
separate package.

CI pins Bun 1.3.14, which reads only lockfile format 1. Bun 1.4 writes a new
lockfile in format 2, so if you regenerate `tools/release/bun.lock` with it, set
`"lockfileVersion"` back to `1` and check that `bun install --frozen-lockfile`
passes on both versions. On 2026-11-01 this lockfile's two formats differed only
in that number. `tests/architecture/release-policy.test.ts` checks both
lockfiles.

The standard release commands call `tools/release/run-ts-release.ts`, a small
Bun adapter over the published `@mannyc1/ts-release/workflows` facade. The adapter
keeps repo-local argument parsing and no-git plan rendering, while delegating
plan rendering, diagnostics, release phase execution, and evidence writes to
`ts-release`:

```sh
bun run release:plan
bun run release:validate
bun run release:check-ci
```

Do not commit local `ts-release` paths, `file:` dependencies, token values, or
private absolute paths. If dogfooding a local `ts-release` checkout, keep that
wiring outside committed manifests and restore the published package dependency
before release-flow changes land.

`release:plan` is safe: it renders the release plan and does not publish.
`release:validate` writes validation evidence through `ts-release` and requires
the npm CLI and `GH_TOKEN` for the GitHub release target. `release:doctor`,
`release:check-auth`, and `release:check-ci` expose the latest static
diagnostics from `ts-release`. For local releases, authenticate GitHub however
you prefer; if using `gh`, export the token explicitly:

```sh
gh auth login
gh auth status
export GH_TOKEN="$(gh auth token)"
```

In GitHub Actions, pass the built-in workflow token to `gh` as
`GH_TOKEN: ${{ github.token }}` and grant `contents: write` for jobs that create
releases. The release workflows call the local wrapper (`bun run release ...`)
so CI uses the exact installed `ts-release` library version. Actual publish
requires an approved workflow command that forwards explicit
irreversible-operation approval:

```sh
bun run release:run --execute --approve-irreversible
```

The protected GitHub `release` environment is the human approval gate. After
that approval, the GitHub release target creates a published release so later
remote-state checks can observe a completed tag.

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
for package in cli fixtures mta nyc-open-data soda3; do
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
package plus the GitHub release tag is missing. The repo-local remote-state
check retries partial states so npm registry propagation has time to settle,
and the execute job rechecks remote state if `ts-release` fails after publishing
side effects. The execute job uses GitHub OIDC instead of `NPM_TOKEN`; it needs
`id-token: write` for npm trusted publishing and `contents: write` for the
GitHub release. Trusted publishing requires Node 22.14.0 or newer and npm
11.5.1 or newer. `npm whoami` does not validate OIDC auth because npm performs
the token exchange during `npm publish`.

## GitHub Runbook

1. Run local checks:
   `bun install`, `bun run check`, `bun run build:cli`,
   `./dist/ntk --version --json`, `bun run release:prepare:npm`,
   `bun run check:npm-stage`, `bun run check:release-config`,
   `bun run check:release-ci`, and `bun run release:plan`.
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
   `packageName`, and the GitHub target creates a published release after
   workflow environment approval.
8. Publish by merging the release/version change to `main` or manually running
   `Release` on `main`. Configure the GitHub `release` environment with required
   reviewers if execution should wait for human approval before npm/GitHub
   publication.
9. Post-publish, verify npm and GitHub state:

```sh
npm view @nyc-transit-kit/soda3 version
npm view @nyc-transit-kit/mta version
npm view @nyc-transit-kit/nyc-open-data version
npm view @nyc-transit-kit/cli version
npm view @nyc-transit-kit/fixtures version
gh release view v0.3.1 --repo mannyc2/nyc-transit-kit
```

Download the GitHub binary artifact and run `ntk --version --json`; it should
report the release version, schema version, source commit, and build target.

## Partial Release Recovery

The `Release` workflow intentionally fails when it detects a partial remote
state, for example when every npm package for a version is published but the
matching GitHub release tag is missing. Do not rerun package publication in that
state; npm package versions are immutable.

npm takes minutes to show a fresh publish. On 2026-11-02 the 0.3.0 run went
red although all five publishes had succeeded: `ts-release` checked for
`@nyc-transit-kit/cli@0.3.0` seconds after publishing it, and the workflow's
recheck gave up after about four minutes, while `mta` took about eight and a
half to appear. The recheck now sleeps up to fifteen minutes in all. Before
acting on a red run, download its `release-execution-evidence` artifact:
`.release/evidence/evidence.json` records each operation's exit code and
output.

First verify the remote state explicitly:

```sh
for package in soda3 mta nyc-open-data cli fixtures; do
  npm view "@nyc-transit-kit/${package}" version
done
gh release view v0.3.1 --repo mannyc2/nyc-transit-kit
```

If npm reports the configured version for every package and `gh release view`
reports a draft release, publish it with:

```sh
gh release edit v0.3.1 --repo mannyc2/nyc-transit-kit --draft=false
```

If npm reports the configured version for every package and `gh release view`
reports the tag is missing, recover only the GitHub release side. Rebuild the
local release artifacts from the exact commit recorded in `release.config.json`,
review `.release/artifacts` and `dist`, then create the missing published
GitHub release with the configured tag and notes:

```sh
bun install
bun run check
bun run build:cli
bun run release:prepare:npm
bun -e 'const config = await Bun.file("release.config.json").json(); await Bun.write("/tmp/nyc-transit-kit-v0.3.1-notes.md", `${config.identity.notes}\n`)'
gh release create v0.3.1 \
  --repo mannyc2/nyc-transit-kit \
  --title "v0.3.1" \
  --notes-file /tmp/nyc-transit-kit-v0.3.1-notes.md \
  dist/ntk \
  dist/ntk-release-manifest.json \
  .release/artifacts/*.tgz
```

After recovery, rerun `gh release view v0.3.1 --repo mannyc2/nyc-transit-kit`.
The next `Release` workflow run should then stop at the remote-state check
instead of attempting another publish.
