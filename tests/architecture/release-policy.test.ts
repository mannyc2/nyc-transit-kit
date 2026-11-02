import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import * as Schema from "effect/Schema"
import ts from "typescript"
import { classifyReleaseState } from "../../scripts/check-release-remote-state"
import {
  dependencyGroups,
  expectedEffectPeerRange,
  expectedEffectToolingVersions,
  expectedEffectVersion,
  expectedRootToolingCatalogVersions,
  isEffectRuntimePackage,
  isEffectToolingPackage,
  readManifest,
  rootPath,
  workspaces
} from "./helpers"

const ReleaseConfig = Schema.Struct({
  targets: Schema.Array(
    Schema.Struct({ _tag: Schema.String, draft: Schema.optionalKey(Schema.Boolean) })
  )
})

const readReleaseConfig = async () =>
  Schema.decodeUnknownSync(Schema.fromJsonString(ReleaseConfig))(
    await Bun.file(join(rootPath, "release.config.json")).text()
  )

describe("release policy", () => {
  const publishedPackageStates = workspaces.map((workspace) => ({
    packageName: `@nyc-transit-kit/${workspace.name}`,
    state: "published" as const
  }))

  it("runs the Effect language service over the whole workspace", async () => {
    const { scripts } = await readManifest(rootPath)
    // tsconfig.json has comments, so TypeScript reads it.
    const tsconfig = ts.readConfigFile(join(rootPath, "tsconfig.json"), ts.sys.readFile)
    const plugins: ReadonlyArray<{ readonly name?: string }> =
      tsconfig.config?.compilerOptions?.plugins ?? []
    const offenders: Array<string> = []

    // The installed effect package, with its AGENTS.md and source, is the API reference.
    if (!scripts?.prepare?.includes("effect-language-service patch")) {
      offenders.push("root prepare script must patch TypeScript with Effect diagnostics")
    }
    if (!scripts?.check?.includes("bun run check:effect")) {
      offenders.push("root check script must run Effect language service diagnostics")
    }
    if (
      !scripts?.["check:effect"]?.includes(
        "effect-language-service diagnostics --project tsconfig.json"
      )
    ) {
      offenders.push("check:effect must run project-wide Effect diagnostics")
    }
    if (!plugins.some((plugin) => plugin.name === "@effect/language-service")) {
      offenders.push("tsconfig.json must enable @effect/language-service")
    }
    expect(offenders).toEqual([])
  })

  it("keeps every workspace and internal dependency on the release version", async () => {
    const { version } = await readManifest(rootPath)
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      const manifest = await readManifest(workspace.path)
      if (manifest.version !== version) {
        offenders.push(`${workspace.name} version ${manifest.version} must equal ${version}`)
      }
      for (const group of dependencyGroups) {
        for (const [name, range] of Object.entries(manifest[group] ?? {})) {
          if (name.startsWith("@nyc-transit-kit/") && range !== version) {
            offenders.push(`${workspace.name} ${group} ${name}@${range} must equal ${version}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("classifies immutable release remote state", () => {
    const missing = publishedPackageStates.map((entry) => ({ ...entry, state: "missing" as const }))
    const mixed = publishedPackageStates.map((entry, index) => ({
      ...entry,
      state: index === 0 ? ("published" as const) : ("missing" as const)
    }))

    expect(
      classifyReleaseState({ githubState: "missing", npmStates: missing, tag: "v1.2.3" })
    ).toMatchObject({ shouldRelease: true, status: "ready" })
    expect(
      classifyReleaseState({
        githubState: "published",
        npmStates: publishedPackageStates,
        tag: "v1.2.3"
      })
    ).toMatchObject({ shouldRelease: false, status: "complete" })
    expect(
      classifyReleaseState({
        githubState: "draft",
        npmStates: publishedPackageStates,
        tag: "v1.2.3"
      })
    ).toMatchObject({ shouldRelease: false, status: "partial" })
    expect(
      classifyReleaseState({ githubState: "missing", npmStates: mixed, tag: "v1.2.3" })
    ).toMatchObject({ shouldRelease: false, status: "partial" })
  })

  it("keeps the release workflow on the shared remote-state guard", async () => {
    const workflow = await Bun.file(join(rootPath, ".github/workflows/release.yml")).text()
    const { targets } = await readReleaseConfig()
    const githubTarget = targets.find((target) => target._tag === "GitHubReleaseTarget")
    const offenders: Array<string> = []

    if (!workflow.includes("bun run release:remote-state")) {
      offenders.push("release workflow must use the repo-local remote-state guard")
    }
    if (workflow.includes("node <<'NODE'")) {
      offenders.push("release workflow must not inline the remote-state guard")
    }
    if (!workflow.includes("--require-complete")) {
      offenders.push("execute job must recheck completed remote state after release failures")
    }
    if (githubTarget?.draft !== false) {
      offenders.push("GitHub release target must publish after release environment approval")
    }
    expect(offenders).toEqual([])
  })

  it("keeps both lockfiles in the format the CI's Bun reads", async () => {
    // Bun 1.4 writes a new lockfile in format 2, which Bun 1.3.14 rejects as "Unknown lockfile version".
    const workflow = await Bun.file(join(rootPath, ".github/workflows/ci.yml")).text()
    expect(workflow).toContain("bun-version: 1.3.14")
    const formats: Record<string, string | undefined> = {}
    for (const lockfile of ["bun.lock", "tools/release/bun.lock"]) {
      const text = await Bun.file(join(rootPath, lockfile)).text()
      formats[lockfile] = /"lockfileVersion": (\d+)/.exec(text)?.[1]
    }
    expect(formats).toEqual({ "bun.lock": "1", "tools/release/bun.lock": "1" })
  })

  it("keeps Effect on 4.0.6: libraries take it as a peer, the app pins it, tooling stays at the root", async () => {
    const root = await readManifest(rootPath)
    const catalog = root.workspaces?.catalog ?? {}
    const catalogs = root.workspaces?.catalogs ?? {}
    const tooling = catalogs.tooling ?? {}
    const rootDevDependencies = root.devDependencies ?? {}
    const offenders: Array<string> = []

    for (const name of ["effect", "@effect/platform-bun", "@effect/vitest"]) {
      if (catalog[name] !== expectedEffectVersion) {
        offenders.push(`root catalog ${name}@${catalog[name]}`)
      }
    }
    for (const [name, version] of Object.entries(catalog)) {
      if (isEffectToolingPackage(name)) {
        offenders.push(`root catalog ${name} belongs in devDependencies`)
      } else if (isEffectRuntimePackage(name) && version !== expectedEffectVersion) {
        offenders.push(`root catalog ${name}@${version}`)
      }
    }
    for (const [name, version] of Object.entries(expectedRootToolingCatalogVersions)) {
      if (tooling[name] !== version) {
        offenders.push(`root tooling catalog ${name}@${tooling[name]}`)
      }
    }
    for (const [catalogName, entries] of Object.entries(catalogs)) {
      for (const name of Object.keys(entries)) {
        if (isEffectToolingPackage(name)) {
          offenders.push(`${name} must not be moved into catalog:${catalogName}`)
        }
      }
    }
    for (const [name, version] of Object.entries(expectedEffectToolingVersions)) {
      if (rootDevDependencies[name] !== version) {
        offenders.push(`root devDependencies ${name}@${rootDevDependencies[name]}`)
      }
    }
    for (const [name, version] of Object.entries(rootDevDependencies)) {
      if (isEffectRuntimePackage(name) && version !== "catalog:") {
        offenders.push(`root devDependencies ${name}@${version} belongs in the workspace catalog`)
      }
      if (expectedRootToolingCatalogVersions[name] !== undefined && version !== "catalog:tooling") {
        offenders.push(`root devDependencies ${name}@${version} must use catalog:tooling`)
      }
    }

    for (const workspace of workspaces) {
      const manifest = await readManifest(workspace.path)
      if (workspace.kind === "package") {
        if (manifest.peerDependencies?.effect !== expectedEffectPeerRange) {
          offenders.push(
            `${workspace.name} peerDependencies effect must be ${expectedEffectPeerRange}`
          )
        }
        for (const group of ["dependencies", "optionalDependencies"] as const) {
          for (const name of Object.keys(manifest[group] ?? {})) {
            if (isEffectRuntimePackage(name)) {
              offenders.push(`${workspace.name} ${group} ${name}: a library takes Effect as a peer`)
            }
          }
        }
      } else if (manifest.dependencies?.effect !== "catalog:") {
        offenders.push(`${workspace.name} pins effect through the catalog`)
      }
      for (const group of dependencyGroups) {
        for (const [name, version] of Object.entries(manifest[group] ?? {})) {
          if (isEffectToolingPackage(name)) {
            offenders.push(`${workspace.name} ${group} ${name} must stay root-only`)
          } else if (version === "catalog:tooling") {
            offenders.push(`${workspace.name} ${group} ${name} must not use catalog:tooling`)
          } else if (
            isEffectRuntimePackage(name) &&
            group !== "peerDependencies" &&
            version !== "catalog:"
          ) {
            offenders.push(`${workspace.name} ${group} ${name}@${version}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
