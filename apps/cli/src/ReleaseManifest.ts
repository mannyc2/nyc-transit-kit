/**
 * `ntk-release-manifest.json`, published beside the compiled binaries of a release.
 */
import * as Schema from "effect/Schema"

export const ManifestVersion = Schema.Literal(1)

export const Platform = Schema.Literals(["darwin", "linux", "win32"])
export type Platform = typeof Platform.Type

export const Architecture = Schema.Literals(["arm64", "x64"])
export type Architecture = typeof Architecture.Type

export const Libc = Schema.Literals(["glibc", "musl"])
export type Libc = typeof Libc.Type

export class Artifact extends Schema.Class<Artifact>("CliReleaseArtifact")({
  platform: Platform,
  arch: Architecture,
  libc: Schema.optionalKey(Libc),
  url: Schema.String,
  sha256: Schema.String,
  size: Schema.Number,
  signed: Schema.Boolean,
  notarized: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseManifest extends Schema.Class<ReleaseManifest>("CliReleaseManifest")({
  manifestVersion: ManifestVersion,
  packageName: Schema.String,
  version: Schema.String,
  schemaVersion: Schema.String,
  schemaCommit: Schema.String,
  generatedSourceCommit: Schema.String,
  builtAt: Schema.String,
  artifacts: Schema.Array(Artifact)
}) {}
