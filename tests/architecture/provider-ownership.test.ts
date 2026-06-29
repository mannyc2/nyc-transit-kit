import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
import { isRecord, rootPath, runProviderCoverageCheck, uniqueSortedStrings } from "./helpers"

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

const runProviderCoverageSet = async (
  entries: ReadonlyArray<{
    readonly provider: CoverageProvider
    readonly input: unknown
  }>
) => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "ntk-provider-coverage-set-"))

  try {
    const providers = await Promise.all(
      entries.map(async (entry, index) => {
        const inputPath = join(tempDirectory, `${index}-${entry.provider}.json`)
        await Bun.write(inputPath, JSON.stringify(entry.input))
        return {
          provider: entry.provider,
          input: inputPath
        }
      })
    )
    const manifestPath = join(tempDirectory, "manifest.json")
    const outPath = join(tempDirectory, "provider-coverage.json")
    await Bun.write(
      manifestPath,
      JSON.stringify({
        providers
      })
    )
    const proc = Bun.spawn(
      [
        "bun",
        "run",
        "scripts/check-provider-coverage-set.ts",
        "--manifest",
        manifestPath,
        "--out",
        outPath
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
    const parsed: unknown = JSON.parse(await Bun.file(outPath).text())

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

describe("provider ownership", () => {
  test("keeps provider descriptor registries SODA3-backed and locally unique", () => {
    expect(nycDotDatasets.length, "nyc-dot").toBeGreaterThan(0)
    expect(mtaOpenDataDatasets.length, "mta-open-data").toBeGreaterThan(0)

    for (const group of descriptorGroups) {
      const ids = group.descriptors.map((descriptor) => String(descriptor.id))

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

  test("keeps curated Socrata dataset ids owned by a single provider package", () => {
    const ownersById = new Map<string, Array<string>>()

    for (const group of descriptorGroups) {
      for (const descriptor of group.descriptors) {
        const id = String(descriptor.id)
        ownersById.set(id, [...(ownersById.get(id) ?? []), group.label])
      }
    }

    const duplicates = [...ownersById.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([id, owners]) => `${id}: ${owners.join(", ")}`)

    expect(duplicates).toEqual([])
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

  test("checks provider coverage release sets", async () => {
    const uniqueLocalIds = uniqueSortedStrings(mtaDirectFeeds.map((feed) => feed.id))
    const result = await runProviderCoverageSet([
      {
        provider: "mta-direct",
        input: mtaDirectFeeds.map((feed) => ({
          id: feed.id,
          url: feed.url
        }))
      }
    ])
    const json = isRecord(result.json) ? result.json : {}
    const providers = Array.isArray(json.providers) ? json.providers : []
    const firstProvider = isRecord(providers[0]) ? providers[0] : {}

    expect(result.stderr.trim()).toBe("")
    expect(result.exitCode).toBe(0)
    expect(json.ok).toBe(true)
    expect(typeof json.generatedAt).toBe("string")
    expect(firstProvider.provider).toBe("mta-direct")
    expect(firstProvider.expectedCount).toBe(uniqueLocalIds.length)
    expect(firstProvider.localCount).toBe(uniqueLocalIds.length)
    expect(firstProvider.ok).toBe(true)
  })

  test("writes provider coverage release evidence when one provider fails", async () => {
    const missingId = "synthetic-missing-feed"
    const result = await runProviderCoverageSet([
      {
        provider: "mta-direct",
        input: [
          ...mtaDirectFeeds.map((feed) => ({
            id: feed.id,
            url: feed.url
          })),
          {
            id: missingId,
            url: "https://example.test/feed"
          }
        ]
      }
    ])
    const json = isRecord(result.json) ? result.json : {}
    const providers = Array.isArray(json.providers) ? json.providers : []
    const firstProvider = isRecord(providers[0]) ? providers[0] : {}

    expect(result.stderr.trim()).toBe("")
    expect(result.exitCode).toBe(1)
    expect(json.ok).toBe(false)
    expect(firstProvider.provider).toBe("mta-direct")
    expect(firstProvider.ok).toBe(false)
    expect(Array.isArray(firstProvider.missingIds) ? firstProvider.missingIds : []).toContain(
      missingId
    )
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
})
