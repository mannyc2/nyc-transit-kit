import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { classifyReleaseState } from "../../scripts/check-release-remote-state"
import {
  dependencyGroups,
  expectedEffectToolingVersions,
  expectedEffectVersion,
  expectedPackages,
  expectedRootToolingCatalogVersions,
  isCatalogReference,
  isEffectRuntimePackage,
  isEffectToolingPackage,
  isRecord,
  packageRoot,
  readJsonRecord,
  rootPath,
  stringValue
} from "./helpers"

describe("release policy", () => {
  const publishedPackageStates = expectedPackages.map((packageName) => ({
    packageName: `@nyc-transit-kit/${packageName}`,
    state: "published" as const
  }))

  test("configures Effect language service for workspace TypeScript", async () => {
    const offenders: Array<string> = []
    const rootManifest = await readJsonRecord(join(rootPath, "package.json"))
    const scripts = isRecord(rootManifest.scripts) ? rootManifest.scripts : {}
    const prepare = typeof scripts.prepare === "string" ? scripts.prepare : ""
    const check = typeof scripts.check === "string" ? scripts.check : ""
    const checkEffect = typeof scripts["check:effect"] === "string" ? scripts["check:effect"] : ""
    const tsconfig = await readJsonRecord(join(rootPath, "tsconfig.base.json"))
    const compilerOptions = isRecord(tsconfig.compilerOptions) ? tsconfig.compilerOptions : {}
    const plugins = Array.isArray(compilerOptions.plugins) ? compilerOptions.plugins : []

    if (!prepare.includes("./scripts/prepare-effect.sh")) {
      offenders.push("root prepare script must keep the vendored Effect repo setup")
    }
    if (!prepare.includes("effect-language-service patch")) {
      offenders.push("root prepare script must patch TypeScript with Effect diagnostics")
    }
    if (!check.includes("bun run check:effect")) {
      offenders.push("root check script must run Effect language service diagnostics")
    }
    if (!checkEffect.includes("effect-language-service diagnostics --project tsconfig.json")) {
      offenders.push("check:effect must run project-wide Effect diagnostics")
    }
    if (!plugins.some((plugin) => isRecord(plugin) && plugin.name === "@effect/language-service")) {
      offenders.push("tsconfig.base.json must enable @effect/language-service")
    }

    expect(offenders).toEqual([])
  })

  test("keeps package release versions synchronized", async () => {
    const rootManifest = await readJsonRecord(join(rootPath, "package.json"))
    const rootVersion = stringValue(rootManifest, "version")
    const offenders: Array<string> = []

    if (rootVersion === undefined) {
      offenders.push("root package.json is missing version")
    }

    for (const packageDirectory of expectedPackages) {
      const manifestPath = join(packageRoot, packageDirectory, "package.json")
      const manifest = await readJsonRecord(manifestPath)
      const manifestVersion = stringValue(manifest, "version")

      if (rootVersion !== undefined && manifestVersion !== rootVersion) {
        offenders.push(`${packageDirectory} version ${manifestVersion} must equal ${rootVersion}`)
      }

      for (const dependencyGroup of dependencyGroups) {
        const dependencies = isRecord(manifest[dependencyGroup]) ? manifest[dependencyGroup] : {}
        for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
          if (
            rootVersion !== undefined &&
            dependencyName.startsWith("@nyc-transit-kit/") &&
            dependencyVersion !== rootVersion
          ) {
            offenders.push(
              `${packageDirectory} ${dependencyGroup} ${dependencyName}@${dependencyVersion} must equal ${rootVersion}`
            )
          }
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test("classifies immutable release remote state", () => {
    const missingPackageStates = publishedPackageStates.map((entry) => ({
      ...entry,
      state: "missing" as const
    }))
    const mixedPackageStates = publishedPackageStates.map((entry, index) => ({
      ...entry,
      state: index === 0 ? ("published" as const) : ("missing" as const)
    }))

    expect(
      classifyReleaseState({
        githubState: "missing",
        npmStates: missingPackageStates,
        tag: "v1.2.3"
      })
    ).toMatchObject({
      shouldRelease: true,
      status: "ready"
    })

    expect(
      classifyReleaseState({
        githubState: "published",
        npmStates: publishedPackageStates,
        tag: "v1.2.3"
      })
    ).toMatchObject({
      shouldRelease: false,
      status: "complete"
    })

    expect(
      classifyReleaseState({
        githubState: "draft",
        npmStates: publishedPackageStates,
        tag: "v1.2.3"
      })
    ).toMatchObject({
      shouldRelease: false,
      status: "partial"
    })

    expect(
      classifyReleaseState({
        githubState: "missing",
        npmStates: mixedPackageStates,
        tag: "v1.2.3"
      })
    ).toMatchObject({
      shouldRelease: false,
      status: "partial"
    })
  })

  test("keeps release workflow on the shared remote-state guard", async () => {
    const offenders: Array<string> = []
    const workflow = await Bun.file(join(rootPath, ".github/workflows/release.yml")).text()
    const releaseConfig = await readJsonRecord(join(rootPath, "release.config.json"))
    const targets = Array.isArray(releaseConfig.targets) ? releaseConfig.targets : []
    const githubTarget = targets.find(
      (target) => isRecord(target) && target._tag === "GitHubReleaseTarget"
    )

    if (!workflow.includes("bun run release:remote-state")) {
      offenders.push("release workflow must use the repo-local remote-state guard")
    }
    if (workflow.includes("node <<'NODE'")) {
      offenders.push("release workflow must not inline the remote-state guard")
    }
    if (!workflow.includes("--require-complete")) {
      offenders.push("execute job must recheck completed remote state after release failures")
    }
    if (!isRecord(githubTarget) || githubTarget.draft !== false) {
      offenders.push("GitHub release target must publish after release environment approval")
    }

    expect(offenders).toEqual([])
  })

  test("keeps Effect runtime packages on the beta line and tooling root-only", async () => {
    const rootManifest = await readJsonRecord(join(rootPath, "package.json"))
    const workspaces = isRecord(rootManifest.workspaces) ? rootManifest.workspaces : {}
    const rootCatalog = isRecord(workspaces.catalog) ? workspaces.catalog : {}
    const rootCatalogs = isRecord(workspaces.catalogs) ? workspaces.catalogs : {}
    const toolingCatalog = isRecord(rootCatalogs.tooling) ? rootCatalogs.tooling : {}
    const rootDevDependencies = isRecord(rootManifest.devDependencies)
      ? rootManifest.devDependencies
      : {}
    const offenders: Array<string> = []

    for (const dependencyName of ["effect", "@effect/platform-bun"]) {
      const version = stringValue(rootCatalog, dependencyName)
      if (version !== expectedEffectVersion) {
        offenders.push(`root catalog ${dependencyName}@${version}`)
      }
    }

    for (const [dependencyName, version] of Object.entries(rootCatalog)) {
      if (isEffectToolingPackage(dependencyName)) {
        offenders.push(`root catalog ${dependencyName} belongs in devDependencies`)
      } else if (isEffectRuntimePackage(dependencyName) && version !== expectedEffectVersion) {
        offenders.push(`root catalog ${dependencyName}@${version}`)
      }
    }

    for (const [dependencyName, expectedVersion] of Object.entries(
      expectedRootToolingCatalogVersions
    )) {
      if (stringValue(toolingCatalog, dependencyName) !== expectedVersion) {
        offenders.push(`root tooling catalog ${dependencyName}@${toolingCatalog[dependencyName]}`)
      }
    }

    for (const [catalogName, catalog] of Object.entries(rootCatalogs)) {
      if (!isRecord(catalog)) {
        continue
      }
      for (const dependencyName of Object.keys(catalog)) {
        if (isEffectToolingPackage(dependencyName)) {
          offenders.push(`${dependencyName} must not be moved into catalog:${catalogName}`)
        }
      }
    }

    for (const [dependencyName, expectedVersion] of Object.entries(expectedEffectToolingVersions)) {
      if (rootDevDependencies[dependencyName] !== expectedVersion) {
        offenders.push(
          `root devDependencies ${dependencyName}@${rootDevDependencies[dependencyName]}`
        )
      }
    }

    for (const [dependencyName, version] of Object.entries(rootDevDependencies)) {
      if (isEffectRuntimePackage(dependencyName)) {
        const allowedRootEffectImport =
          (dependencyName === "effect" || dependencyName === "@effect/platform-bun") &&
          version === "catalog:" &&
          stringValue(rootCatalog, dependencyName) === expectedEffectVersion
        if (!allowedRootEffectImport) {
          offenders.push(
            `root devDependencies ${dependencyName}@${version} belongs in workspace catalog`
          )
        }
        continue
      }
      if (isEffectToolingPackage(dependencyName) && isCatalogReference(version)) {
        offenders.push(`root devDependencies ${dependencyName} must stay a literal version`)
      }
      if (expectedRootToolingCatalogVersions[dependencyName] !== undefined) {
        if (version !== "catalog:tooling") {
          offenders.push(
            `root devDependencies ${dependencyName}@${version} must use catalog:tooling`
          )
        }
      } else if (isCatalogReference(version)) {
        offenders.push(
          `root devDependencies ${dependencyName}@${version} is not an approved catalog reference`
        )
      }
    }

    for (const packageDirectory of expectedPackages) {
      const manifestPath = join(packageRoot, packageDirectory, "package.json")
      const manifest = await readJsonRecord(manifestPath)

      for (const dependencyGroup of dependencyGroups) {
        const dependencies = isRecord(manifest[dependencyGroup]) ? manifest[dependencyGroup] : {}
        for (const [dependencyName, version] of Object.entries(dependencies)) {
          if (isEffectToolingPackage(dependencyName)) {
            offenders.push(
              `${packageDirectory} ${dependencyGroup} ${dependencyName} must stay root-only`
            )
          } else if (version === "catalog:tooling") {
            offenders.push(
              `${packageDirectory} ${dependencyGroup} ${dependencyName} must not use catalog:tooling`
            )
          } else if (
            isEffectRuntimePackage(dependencyName) &&
            version !== expectedEffectVersion &&
            (version !== "catalog:" ||
              stringValue(rootCatalog, dependencyName) !== expectedEffectVersion)
          ) {
            offenders.push(`${packageDirectory} ${dependencyGroup} ${dependencyName}@${version}`)
          }
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
