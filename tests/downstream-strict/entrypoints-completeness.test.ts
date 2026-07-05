import { describe, expect, test } from "bun:test"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

const rootPath = new URL("../../", import.meta.url).pathname
const packageRoot = join(rootPath, "packages")
const packageEntrypointsPath = join(
  rootPath,
  "tests",
  "downstream-strict",
  "package-entrypoints.ts"
)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const readJsonRecord = async (path: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(parsed)) {
    throw new Error(`${path} did not contain a JSON object`)
  }
  return parsed
}

const publicExportKeys = (manifest: Record<string, unknown>) => {
  const exportsValue = manifest.exports
  if (!isRecord(exportsValue)) {
    return []
  }

  return Object.keys(exportsValue)
}

const importPathFor = (packageName: string, exportKey: string) =>
  exportKey === "." ? packageName : `${packageName}/${exportKey.slice(2)}`

const publicPackageSpecifiers = async () => {
  const entries = await readdir(packageRoot, { withFileTypes: true })
  const specifiers = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const manifest = await readJsonRecord(join(packageRoot, entry.name, "package.json"))
        const packageName = manifest.name
        if (typeof packageName !== "string") {
          throw new Error(`${entry.name} package.json is missing name`)
        }
        return publicExportKeys(manifest).map((exportKey) => importPathFor(packageName, exportKey))
      })
  )

  return specifiers.flat().toSorted()
}

describe("downstream strict entrypoint coverage", () => {
  test("imports every public package export", async () => {
    const source = await Bun.file(packageEntrypointsPath).text()
    const missing = (await publicPackageSpecifiers()).filter(
      (specifier) => !source.includes(`"${specifier}"`)
    )

    expect(missing).toEqual([])
  })
})
