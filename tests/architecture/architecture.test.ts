import { describe, expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, extname, join } from "node:path"
import { mtaOpenDataDatasets } from "../../packages/mta/src/datasets"
import { mtaDirectFeeds } from "../../packages/mta/src/feeds"
import { nycDotDatasets } from "../../packages/nyc-dot/src/datasets"
import { knownNycOpenDataDatasets } from "../../packages/nyc-open-data/src/descriptors"
import {
  type CoverageProvider,
  coverageProviders,
  descriptorProviders
} from "../../scripts/provider-descriptor-shared"
import { prepareProvider } from "../../scripts/update-descriptor-records"

const rootPath = new URL("../../", import.meta.url).pathname
const packageRoot = join(rootPath, "packages")
const expectedPackages = [
  "contracts",
  "soda3",
  "mta",
  "nyc-open-data",
  "nyc-dot",
  "cli",
  "compat",
  "fixtures"
]

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"])
const soda3GuardExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt", ".csv"])
const expectedEffectVersion = "4.0.0-beta.83"
const expectedEffectToolingVersions: Record<string, string> = {
  "@effect/language-service": "0.86.2"
}
const expectedRootToolingCatalogVersions: Record<string, string> = {
  "@biomejs/biome": "2.5.0",
  "@types/bun": "1.3.14",
  typescript: "6.0.3"
}
const dependencyGroups = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
]
const subpathExportPackages = new Set([
  "contracts",
  "soda3",
  "mta",
  "nyc-open-data",
  "nyc-dot",
  "compat"
])
const rootImportPattern = /from\s+["'](@nyc-transit-kit\/[^/"']+)["']/g
const isInternalSourceFile = (file: string) => file.includes("/src/internal/")
const isEffectToolingPackage = (dependencyName: string) =>
  expectedEffectToolingVersions[dependencyName] !== undefined
const isEffectRuntimePackage = (dependencyName: string) =>
  dependencyName === "effect" ||
  (dependencyName.startsWith("@effect/") && !isEffectToolingPackage(dependencyName))
const stringValue = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}
const isCatalogReference = (value: unknown) =>
  typeof value === "string" && value.startsWith("catalog:")
const uniqueSortedStrings = (values: ReadonlyArray<string>) => [...new Set(values)].toSorted()

const walkFiles = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return walkFiles(path)
      }
      return [path]
    })
  )

  return nested.flat()
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const readJsonRecord = async (path: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(parsed)) {
    throw new Error(`${path} did not contain a JSON object`)
  }
  return parsed
}

const collectStringTargets = (value: unknown): ReadonlyArray<string> => {
  const targets: Array<string> = []
  const visit = (candidate: unknown) => {
    if (typeof candidate === "string") {
      targets.push(candidate)
      return
    }
    if (isRecord(candidate)) {
      for (const nested of Object.values(candidate)) {
        visit(nested)
      }
    }
  }
  visit(value)
  return targets
}

const exportEntries = (manifest: Record<string, unknown>) => {
  const exportsValue = manifest.exports
  if (!isRecord(exportsValue)) {
    return []
  }

  return Object.entries(exportsValue).map(([key, value]) => ({
    key,
    targets: collectStringTargets(value)
  }))
}

const packageCodeFiles = async (packageDirectory: string) =>
  (await walkFiles(join(packageRoot, packageDirectory)))
    .filter((file) => !file.includes("/dist/"))
    .filter((file) => file.includes("/src/") || file.includes("/scripts/"))
    .filter((file) => sourceExtensions.has(extname(file)))

const packagePublicSourceFiles = async (packageDirectoryPath: string) =>
  (await walkFiles(join(packageDirectoryPath, "src")))
    .filter((file) => sourceExtensions.has(extname(file)))
    .filter((file) => !isInternalSourceFile(file))
    .filter((file) => basename(file) !== "index.ts")

const runProviderCoverageCheck = async (provider: CoverageProvider, input: unknown) => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "ntk-provider-coverage-"))

  try {
    const inputPath = join(tempDirectory, `${provider}.json`)
    await Bun.write(inputPath, JSON.stringify(input))
    const proc = Bun.spawn(
      [
        "bun",
        "run",
        "scripts/check-provider-coverage.ts",
        "--provider",
        provider,
        "--input",
        inputPath
      ],
      {
        cwd: rootPath,
        stderr: "pipe",
        stdout: "pipe"
      }
    )
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited
    const parsed: unknown = JSON.parse(stdout)

    return {
      exitCode,
      json: parsed,
      stderr,
      stdout
    }
  } finally {
    await rm(tempDirectory, {
      recursive: true,
      force: true
    })
  }
}

describe("architecture guardrails", () => {
  test("contains every planned package slot", async () => {
    const entries = await readdir(packageRoot, { withFileTypes: true })
    const packages = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

    expect(packages.sort()).toEqual(expectedPackages.toSorted())
  })

  test("keeps legacy Socrata endpoint support out of source, manifests, and fixtures", async () => {
    const files = (
      await Promise.all(
        expectedPackages.map((packageDirectory) => walkFiles(join(packageRoot, packageDirectory)))
      )
    )
      .flat()
      .filter((file) => !file.includes("/dist/"))
      .filter((file) => !file.includes("/test/"))
      .filter((file) => soda3GuardExtensions.has(extname(file)) || file.endsWith("package.json"))
    const offenders: Array<string> = []

    for (const file of files) {
      const source = await Bun.file(file).text()
      if (/\/resource\/|soda2/i.test(source)) {
        offenders.push(file.replace(rootPath, ""))
      }
    }

    expect(offenders).toEqual([])
  })

  test("does not use wildcard barrels in package entrypoints", async () => {
    const offenders: Array<string> = []

    for (const packageDirectory of expectedPackages) {
      const entrypoint = join(packageRoot, packageDirectory, "src", "index.ts")
      const source = await Bun.file(entrypoint).text()
      if (/export\s+\*\s+from/.test(source)) {
        offenders.push(entrypoint.replace(rootPath, ""))
      }
    }

    expect(offenders).toEqual([])
  })

  test("exposes subpath exports for package source modules", async () => {
    const offenders: Array<string> = []

    for (const packageDirectory of subpathExportPackages) {
      const packageDirectoryPath = join(packageRoot, packageDirectory)
      const manifest = await readJsonRecord(join(packageDirectoryPath, "package.json"))
      const exportedSubpaths = new Set(
        exportEntries(manifest)
          .map((entry) => entry.key)
          .filter((key) => key !== ".")
      )
      const sourceFiles = await packagePublicSourceFiles(packageDirectoryPath)

      for (const file of sourceFiles) {
        const expectedSubpath = `./${basename(file, extname(file))}`
        if (!exportedSubpaths.has(expectedSubpath)) {
          offenders.push(`${packageDirectory}: missing export ${expectedSubpath}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test("keeps package export targets real and publishable", async () => {
    const offenders: Array<string> = []

    for (const packageDirectory of expectedPackages) {
      const packageDirectoryPath = join(packageRoot, packageDirectory)
      const manifest = await readJsonRecord(join(packageDirectoryPath, "package.json"))
      const filesValue = manifest.files
      const files = Array.isArray(filesValue)
        ? filesValue.filter((entry): entry is string => typeof entry === "string")
        : []

      for (const { key, targets } of exportEntries(manifest)) {
        for (const target of targets) {
          if (!target.startsWith("./")) {
            offenders.push(`${packageDirectory}: export ${key} target ${target} is not relative`)
            continue
          }

          if (target.includes("/src/internal/")) {
            offenders.push(
              `${packageDirectory}: export ${key} target ${target} points at private internal source`
            )
          }

          const archivePath = target.slice(2)
          const targetExists = await Bun.file(join(packageDirectoryPath, archivePath)).exists()
          if (!targetExists) {
            offenders.push(`${packageDirectory}: export ${key} target ${target} does not exist`)
          }

          const includedByFiles = files.some(
            (entry) => archivePath === entry || archivePath.startsWith(`${entry}/`)
          )
          if (!includedByFiles) {
            offenders.push(`${packageDirectory}: export ${key} target ${target} is outside files`)
          }
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test("uses subpath imports for internal package dependencies", async () => {
    const packagesWithSubpaths = new Set(
      [...subpathExportPackages].map((packageDirectory) => `@nyc-transit-kit/${packageDirectory}`)
    )
    const offenders: Array<string> = []

    for (const packageDirectory of expectedPackages) {
      for (const file of await packageCodeFiles(packageDirectory)) {
        const source = await Bun.file(file).text()
        for (const match of source.matchAll(rootImportPattern)) {
          const packageName = match[1]
          if (packageName !== undefined && packagesWithSubpaths.has(packageName)) {
            offenders.push(`${file.replace(rootPath, "")}: imports ${packageName} root`)
          }
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test("uses deep Effect module imports in package source", async () => {
    const offenders: Array<string> = []

    for (const packageDirectory of expectedPackages) {
      for (const file of await packageCodeFiles(packageDirectory)) {
        const source = await Bun.file(file).text()
        if (/from\s+["']effect["']/.test(source)) {
          offenders.push(file.replace(rootPath, ""))
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test("keeps the CLI on Effect command parsing", async () => {
    const forbiddenNames = [
      "parseOptions",
      "commandTokensFrom",
      "sameCommandPath",
      "CommandDefinition"
    ]
    const forbiddenPattern = new RegExp(`\\b(${forbiddenNames.join("|")})\\b`)
    const offenders: Array<string> = []
    const files = (await walkFiles(join(packageRoot, "cli", "src"))).filter((file) =>
      sourceExtensions.has(extname(file))
    )

    for (const file of files) {
      const source = await Bun.file(file).text()
      if (forbiddenPattern.test(source)) {
        offenders.push(file.replace(rootPath, ""))
      }
    }

    expect(offenders).toEqual([])
  })

  test("keeps environment reads out of core packages", async () => {
    const corePackages = expectedPackages.filter((packageDirectory) => packageDirectory !== "cli")
    const offenders: Array<string> = []

    for (const packageDirectory of corePackages) {
      const files = (await walkFiles(join(packageRoot, packageDirectory, "src"))).filter((file) =>
        sourceExtensions.has(extname(file))
      )
      for (const file of files) {
        const source = await Bun.file(file).text()
        if (/\bprocess\.env\b/.test(source)) {
          offenders.push(file.replace(rootPath, ""))
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test("keeps provider descriptor registries SODA3-backed and unique", () => {
    const descriptorGroups = [
      {
        label: "nyc-open-data",
        domain: "data.cityofnewyork.us",
        descriptors: knownNycOpenDataDatasets
      },
      {
        label: "nyc-dot",
        domain: "data.cityofnewyork.us",
        descriptors: nycDotDatasets
      },
      {
        label: "mta-open-data",
        domain: "data.ny.gov",
        descriptors: mtaOpenDataDatasets
      }
    ]

    for (const group of descriptorGroups) {
      const ids = group.descriptors.map((descriptor) => String(descriptor.id))

      expect(group.descriptors.length, group.label).toBeGreaterThan(0)
      expect(new Set(ids).size, group.label).toBe(ids.length)

      for (const descriptor of group.descriptors) {
        expect(String(descriptor.domain), group.label).toBe(group.domain)
        expect(descriptor.backing, group.label).toBe("socrata")
      }
    }

    const dotNames = nycDotDatasets.map((descriptor) => String(descriptor.name))
    expect(new Set(dotNames).size, "nyc-dot names").toBe(dotNames.length)
    for (const name of dotNames) {
      expect(name, "nyc-dot lower-kebab name").toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  test("validates descriptor record imports without writing manifests", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "ntk-descriptor-records-"))

    try {
      const inputPath = join(tempDirectory, "nyc-dot.json")
      await Bun.write(
        inputPath,
        JSON.stringify([
          {
            resource: {
              id: "abcd-1234",
              name: "Example Safety Counts",
              domain: "data.cityofnewyork.us",
              description: "Synthetic descriptor import fixture."
            }
          }
        ])
      )

      const proc = Bun.spawn(
        [
          "bun",
          "run",
          "scripts/update-descriptor-records.ts",
          "--provider",
          "nyc-dot",
          "--input",
          inputPath
        ],
        {
          cwd: rootPath,
          stderr: "pipe",
          stdout: "pipe"
        }
      )
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(stderr.trim()).toBe("")
      expect(exitCode).toBe(0)
      expect(stdout).toContain('"provider": "nyc-dot"')
      expect(stdout).toContain('"count": 1')
      expect(stdout).toContain('"write": false')
    } finally {
      await rm(tempDirectory, {
        recursive: true,
        force: true
      })
    }
  })

  test("preserves descriptor metadata when preparing generated records", () => {
    const prepared = prepareProvider("nyc-dot", [
      {
        resource: {
          id: "abcd-1234",
          name: "Example Safety Counts",
          domain: "data.cityofnewyork.us",
          description: "Synthetic descriptor import fixture."
        },
        sourceUrl: "https://data.cityofnewyork.us/d/abcd-1234",
        tags: ["transportation", "safety"],
        temporalFields: ["count_date"],
        adapterStatus: "row-schema",
        lastVerified: "2026-06-16"
      }
    ])
    const record = prepared.records[0]

    expect(record?.sourceUrl).toBe("https://data.cityofnewyork.us/d/abcd-1234")
    expect(record?.tags).toEqual(["transportation", "safety"])
    expect(record?.temporalFields).toEqual(["count_date"])
    expect(record?.adapterStatus).toBe("row-schema")
    expect(record?.lastVerified).toBe("2026-06-16")
    expect(prepared.content).toContain('sourceUrl: "https://data.cityofnewyork.us/d/abcd-1234"')
    expect(prepared.content).toContain('tags: ["transportation", "safety"]')
    expect(prepared.content).toContain('temporalFields: ["count_date"]')
    expect(prepared.content).toContain('adapterStatus: "row-schema"')
    expect(prepared.content).toContain('lastVerified: "2026-06-16"')
  })

  test("keeps provider descriptor script primitives shared", async () => {
    const scriptNames = ["update-descriptor-records.ts", "check-provider-coverage.ts"]
    const forbiddenLocalDefinitions = [
      {
        label: "type Provider",
        pattern: /\btype\s+Provider\s*=/
      },
      {
        label: "const parseProvider",
        pattern: /\bconst\s+parseProvider\s*=/
      },
      {
        label: "const requiredArgValue",
        pattern: /\bconst\s+requiredArgValue\s*=/
      },
      {
        label: "const catalogResource",
        pattern: /\bconst\s+catalogResource\s*=/
      }
    ]
    const offenders: Array<string> = []

    for (const scriptName of scriptNames) {
      const source = await Bun.file(join(rootPath, "scripts", scriptName)).text()
      if (!source.includes('from "./provider-descriptor-shared"')) {
        offenders.push(`${scriptName}: missing shared helper import`)
      }

      for (const definition of forbiddenLocalDefinitions) {
        if (definition.pattern.test(source)) {
          offenders.push(`${scriptName}: defines ${definition.label} locally`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test("checks provider coverage from local source snapshots", async () => {
    const result = await runProviderCoverageCheck("mta-open-data", [
      {
        "Open Dataset ID": "f462-ka72",
        Name: "MTA Open Data Catalog"
      }
    ])
    const json = isRecord(result.json) ? result.json : {}

    expect(result.stderr.trim()).toBe("")
    expect(result.exitCode).toBe(0)
    expect(json.provider).toBe("mta-open-data")
    expect(json.expectedCount).toBe(1)
    expect(json.localCount).toBe(1)
    expect(json.ok).toBe(true)
  })

  test("reports missing provider coverage ids", async () => {
    const result = await runProviderCoverageCheck("mta-open-data", {
      rows: [
        {
          "Open Dataset ID": "f462-ka72"
        },
        {
          "Open Dataset ID": "abcd-1234"
        }
      ]
    })
    const json = isRecord(result.json) ? result.json : {}

    expect(result.stderr.trim()).toBe("")
    expect(result.exitCode).toBe(1)
    expect(json.provider).toBe("mta-open-data")
    expect(json.ok).toBe(false)
    expect(Array.isArray(json.missingIds) ? json.missingIds : []).toContain("abcd-1234")
  })

  test("reports extra local provider descriptor ids", async () => {
    const result = await runProviderCoverageCheck("nyc-dot", [
      {
        resource: {
          id: "ycrg-ses3",
          name: "Bus Lanes - Local Streets",
          domain: "data.cityofnewyork.us"
        }
      }
    ])
    const json = isRecord(result.json) ? result.json : {}

    expect(result.stderr.trim()).toBe("")
    expect(result.exitCode).toBe(1)
    expect(json.provider).toBe("nyc-dot")
    expect(json.ok).toBe(false)
    expect(Array.isArray(json.extraIds) ? json.extraIds : []).toEqual(["btm5-ppia", "i4gi-tjb9"])
  })

  test("checks MTA direct feed coverage from normalized snapshots", async () => {
    const uniqueLocalIds = uniqueSortedStrings(mtaDirectFeeds.map((feed) => feed.id))
    const result = await runProviderCoverageCheck(
      "mta-direct",
      mtaDirectFeeds.map((feed) => ({
        id: feed.id,
        url: feed.url
      }))
    )
    const json = isRecord(result.json) ? result.json : {}

    expect(result.stderr.trim()).toBe("")
    expect(result.exitCode).toBe(0)
    expect(json.provider).toBe("mta-direct")
    expect(json.expectedCount).toBe(uniqueLocalIds.length)
    expect(json.localCount).toBe(uniqueLocalIds.length)
    expect(json.ok).toBe(true)
  })

  test("reports missing MTA direct feed ids", async () => {
    const missingId = "synthetic-missing-feed"
    const result = await runProviderCoverageCheck("mta-direct", [
      ...mtaDirectFeeds.map((feed) => ({
        id: feed.id,
        url: feed.url
      })),
      {
        id: missingId,
        url: "https://example.test/feed"
      }
    ])
    const json = isRecord(result.json) ? result.json : {}

    expect(result.stderr.trim()).toBe("")
    expect(result.exitCode).toBe(1)
    expect(json.provider).toBe("mta-direct")
    expect(json.ok).toBe(false)
    expect(Array.isArray(json.missingIds) ? json.missingIds : []).toContain(missingId)
  })

  test("reports extra local MTA direct feed ids", async () => {
    const omittedId = "subway-regular"
    const result = await runProviderCoverageCheck(
      "mta-direct",
      mtaDirectFeeds
        .filter((feed) => feed.id !== omittedId)
        .map((feed) => ({
          id: feed.id,
          url: feed.url
        }))
    )
    const json = isRecord(result.json) ? result.json : {}

    expect(result.stderr.trim()).toBe("")
    expect(result.exitCode).toBe(1)
    expect(json.provider).toBe("mta-direct")
    expect(json.ok).toBe(false)
    expect(Array.isArray(json.extraIds) ? json.extraIds : []).toContain(omittedId)
  })

  test("keeps provider coverage labels aligned with descriptor import labels", async () => {
    expect(coverageProviders.toSorted()).toEqual([...descriptorProviders, "mta-direct"].toSorted())

    const cases = [
      {
        provider: "nyc-open-data",
        ids: knownNycOpenDataDatasets.map((descriptor) => String(descriptor.id))
      },
      {
        provider: "nyc-dot",
        ids: nycDotDatasets.map((descriptor) => String(descriptor.id))
      },
      {
        provider: "mta-open-data",
        ids: mtaOpenDataDatasets.map((descriptor) => String(descriptor.id))
      },
      {
        provider: "mta-direct",
        ids: mtaDirectFeeds.map((feed) => feed.id)
      }
    ] satisfies ReadonlyArray<{
      readonly provider: CoverageProvider
      readonly ids: ReadonlyArray<string>
    }>

    for (const testCase of cases) {
      const result = await runProviderCoverageCheck(
        testCase.provider,
        testCase.ids.map((id) => ({ id }))
      )
      const json = isRecord(result.json) ? result.json : {}

      expect(result.exitCode, testCase.provider).toBe(0)
      expect(json.provider, testCase.provider).toBe(testCase.provider)
      expect(json.ok, testCase.provider).toBe(true)
    }
  })

  test("keeps root tooling scripts on workspace dependency imports", async () => {
    const files = (await walkFiles(join(rootPath, "scripts"))).filter((file) =>
      sourceExtensions.has(extname(file))
    )
    const forbiddenDependencyPath = /(?:packages\/[^"'\s]+\/node_modules\/|node_modules\/\.bun\/)/
    const offenders: Array<string> = []

    for (const file of files) {
      const source = await Bun.file(file).text()
      if (forbiddenDependencyPath.test(source)) {
        offenders.push(file.replace(rootPath, ""))
      }
    }

    expect(offenders).toEqual([])
  })

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
