import * as Schema from "effect/Schema"

export const CliReleaseManifestVersion = Schema.Literal(1)
export type CliReleaseManifestVersion = typeof CliReleaseManifestVersion.Type

export const ArtifactPlatform = Schema.Literals(["darwin", "linux", "win32"])
export type ArtifactPlatform = typeof ArtifactPlatform.Type

export const ArtifactArchitecture = Schema.Literals(["arm64", "x64"])
export type ArtifactArchitecture = typeof ArtifactArchitecture.Type

export const ArtifactLibc = Schema.Literals(["glibc", "musl"])
export type ArtifactLibc = typeof ArtifactLibc.Type

export class CliReleaseArtifact extends Schema.Class<CliReleaseArtifact>("CliReleaseArtifact")({
  platform: ArtifactPlatform,
  arch: ArtifactArchitecture,
  libc: Schema.optionalKey(ArtifactLibc),
  url: Schema.String,
  sha256: Schema.String,
  size: Schema.Number,
  signed: Schema.Boolean,
  notarized: Schema.optionalKey(Schema.Boolean)
}) {}

export class CliReleaseManifest extends Schema.Class<CliReleaseManifest>("CliReleaseManifest")({
  manifestVersion: CliReleaseManifestVersion,
  packageName: Schema.String,
  version: Schema.String,
  schemaVersion: Schema.String,
  schemaCommit: Schema.String,
  generatedSourceCommit: Schema.String,
  builtAt: Schema.String,
  artifacts: Schema.Array(CliReleaseArtifact)
}) {}
