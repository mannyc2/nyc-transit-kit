import { describe, expect, test } from "bun:test"
import { readdir } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import {
  expectedPackages,
  exportEntries,
  packageCodeFiles,
  packagePublicSourceFiles,
  packageRoot,
  readJsonRecord,
  rootImportPattern,
  rootPath,
  soda3GuardExtensions,
  sourceExtensions,
  subpathExportPackages,
  walkFiles
} from "./helpers"

describe("package architecture", () => {
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
})
