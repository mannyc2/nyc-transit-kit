// `bun build --define` replaces the two `process.env` reads in the compiled binary.
// Declared here so the source compiles without Node or Bun types.
declare const process: {
  readonly env: { readonly NTK_BUILD_COMMIT?: string; readonly NTK_BUILD_TARGET?: string }
}

/** The release version. `bun run release:version` keeps it equal to package.json. */
export const version = "0.3.0"

export const commit = process.env.NTK_BUILD_COMMIT ?? "unknown"

export const buildTarget = process.env.NTK_BUILD_TARGET ?? "source"
