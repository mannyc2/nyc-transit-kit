import { readdir } from "node:fs/promises"
import { basename, join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import {
  allowedInternalDependencies,
  apps,
  codeFiles,
  display,
  moduleNames,
  packages,
  readManifest,
  rootPath,
  walkFiles,
  workspaces
} from "./helpers"

const directories = async (path: string) =>
  (await readdir(path, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()

describe("layout", () => {
  it("apps deploy and packages are libraries", async () => {
    expect(await directories(join(rootPath, "apps"))).toEqual(apps.toSorted())
    expect(await directories(join(rootPath, "packages"))).toEqual(packages.toSorted())
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      const manifest = await readManifest(workspace.path)
      if (workspace.kind === "app" && manifest.bin === undefined) {
        offenders.push(`${workspace.name}: an app has a bin`)
      }
      if (workspace.kind === "package" && manifest.bin !== undefined) {
        offenders.push(`${workspace.name}: a library has no bin`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("names modules in PascalCase, and each test after the module it tests", async () => {
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      const modules = new Set(await moduleNames(workspace))
      for (const file of await codeFiles(workspace, ["src"])) {
        const name = basename(file)
        if (name !== "index.ts" && name !== "bin.ts" && !/^[A-Z][A-Za-z0-9]*\.ts$/.test(name)) {
          offenders.push(`${display(file)}: module file names are PascalCase`)
        }
      }
      for (const file of await codeFiles(workspace, ["test"])) {
        const tested = basename(file).match(/^([A-Z][A-Za-z0-9]*)\.test\.ts$/)?.[1]
        if (tested === undefined || !modules.has(tested)) {
          offenders.push(`${display(file)}: a test is named after a module of src`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("keeps SODA2 endpoints out of code, manifests and samples", async () => {
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      const files = (await walkFiles(workspace.path)).filter(
        (file) => !file.includes("/test/") && /\.(ts|json|md)$/.test(file)
      )
      for (const file of files) {
        if (/\/resource\/|soda2/i.test(await Bun.file(file).text())) {
          offenders.push(display(file))
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("public modules", () => {
  it("every module of a package is a subpath export, and the app exports what it lists", async () => {
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      const manifest = await readManifest(workspace.path)
      const exported = Object.keys(manifest.exports ?? {}).filter((key) => key !== ".")
      if (workspace.kind === "package") {
        const expected = (await moduleNames(workspace)).map((name) => `./${name}`)
        if (exported.toSorted().join() !== expected.join()) {
          offenders.push(`${workspace.name}: exports ${exported} instead of ${expected}`)
        }
      }
      // index.ts re-exports each public module under its own name, and nothing else.
      const index = await Bun.file(join(workspace.path, "src", "index.ts")).text()
      const lines = index.split("\n").filter((line) => line.trim() !== "")
      const barrel = lines.map((line) => line.match(/^export \* as (\w+) from "\.\/(\w+)"$/))
      if (barrel.some((match) => match === null || match[1] !== match[2])) {
        offenders.push(`${workspace.name}: index.ts is not a namespace barrel`)
      }
      const reexported = barrel.map((match) => `./${match?.[1]}`).toSorted()
      if (reexported.join() !== exported.toSorted().join()) {
        offenders.push(`${workspace.name}: index.ts re-exports ${reexported}, not ${exported}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("export targets exist and ship", async () => {
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      const manifest = await readManifest(workspace.path)
      const files = manifest.files ?? []
      const targets = [
        ...Object.entries(manifest.exports ?? {}),
        ...Object.entries(manifest.bin ?? {})
      ]
      for (const [key, target] of targets) {
        const path = target.replace(/^\.\//, "")
        if (!target.startsWith("./")) {
          offenders.push(`${workspace.name}: ${key} target ${target} is not relative`)
        }
        if (!(await Bun.file(join(workspace.path, path)).exists())) {
          offenders.push(`${workspace.name}: ${key} target ${target} does not exist`)
        }
        if (!files.some((entry) => path === entry || path.startsWith(`${entry}/`))) {
          offenders.push(`${workspace.name}: ${key} target ${target} is outside files`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("imports", () => {
  it("import sibling packages by subpath and Effect by module", async () => {
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      for (const file of await codeFiles(workspace)) {
        const source = await Bun.file(file).text()
        if (/from\s+["']@nyc-transit-kit\/[^/"']+["']/.test(source)) {
          offenders.push(`${display(file)}: imports a package root`)
        }
        if (/from\s+["']effect["']/.test(source)) {
          offenders.push(`${display(file)}: imports effect's root`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("each workspace depends only on the packages below it", async () => {
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      const allowed = new Set(
        (allowedInternalDependencies[workspace.name] ?? []).map(
          (name) => `@nyc-transit-kit/${name}`
        )
      )
      const manifest = await readManifest(workspace.path)
      for (const name of Object.keys(manifest.dependencies ?? {})) {
        if (name.startsWith("@nyc-transit-kit/") && !allowed.has(name)) {
          offenders.push(`${workspace.name}: depends on ${name}`)
        }
      }
      for (const file of await codeFiles(workspace, ["src", "scripts"])) {
        const source = await Bun.file(file).text()
        for (const [, name] of source.matchAll(/from\s+["'](@nyc-transit-kit\/[^/"']+)/g)) {
          if (name !== undefined && !allowed.has(name)) {
            offenders.push(`${display(file)}: imports ${name}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("root scripts and tests reach packages by path, not through installed copies", async () => {
    const files = [
      ...(await walkFiles(join(rootPath, "scripts"))),
      ...(await walkFiles(join(rootPath, "tests")))
    ]
    const offenders: Array<string> = []
    for (const file of files) {
      const source = await Bun.file(file).text()
      if (/(?:\/node_modules\/|from\s+["']@nyc-transit-kit\/)/.test(source)) {
        offenders.push(display(file))
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("Effect style", () => {
  // The guards from the Effect design guide's lint table.
  const guards = [
    {
      pattern: /\bas unknown as\b/,
      rule: "no `as unknown as`: a double cast claims a type nothing checked"
    },
    {
      pattern: /\bnew Date\(\s*\)|\bDate\.now\(\)/,
      rule: "no reading the wall clock: read Clock, which a test can move"
    },
    { pattern: /^(?:export )?let /m, rule: "no top-level `let`: no module state" },
    { pattern: /\bEffect\.promise\(/, rule: "no `Effect.promise`: a rejection becomes a defect" },
    { pattern: /\bnew Error\(/, rule: "no `new Error`: fail with a Schema.TaggedError" },
    {
      pattern: /\bEffect\.run[A-Z]\w*\(/,
      rule: "no `Effect.run*`: effects run at the runtime edge"
    },
    {
      pattern: /(?:^|[^.\w])fetch\(/m,
      rule: "no global `fetch`: use HttpClient, which a test replaces"
    },
    {
      pattern: /effect\/unstable\//,
      rule: "no `effect/unstable/*`: 4.0.6 ships these modules as stable"
    }
  ]
  const libraryGuards = [
    {
      pattern: /\bprocess\.env\b|from "effect\/Config(?:Provider)?"/,
      rule: "no `process.env`, Config or ConfigProvider in a library: packages take values"
    },
    {
      pattern: /\bEffect\.(?:retry|timeout\w*)\b|\bretryTransient\b|from "effect\/Schedule"/,
      rule: "no retry or timeout in a library: callers compose Effect.retry and Effect.timeout"
    }
  ]

  it("follows the design guide's lint guards", async () => {
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      const applicable = workspace.kind === "package" ? [...guards, ...libraryGuards] : guards
      for (const file of await codeFiles(workspace, ["src"])) {
        const source = await Bun.file(file).text()
        for (const { pattern, rule } of applicable) {
          if (pattern.test(source)) {
            offenders.push(`${display(file)}: ${rule}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("names each service key @nyc-transit-kit/<workspace>/<ClassName>", async () => {
    const offenders: Array<string> = []
    for (const workspace of workspaces) {
      for (const file of await codeFiles(workspace, ["src"])) {
        const source = await Bun.file(file).text()
        for (const [, className, key] of source.matchAll(
          /class (\w+) extends Context\.Service<[\s\S]*?>\(\)\(\s*"([^"]+)"/g
        )) {
          if (key !== `@nyc-transit-kit/${workspace.name}/${className}`) {
            offenders.push(`${display(file)}: ${className} has key ${key}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("parses the command line with effect/cli", async () => {
    const forbidden = /\b(parseOptions|commandTokensFrom|sameCommandPath|CommandDefinition)\b/
    const offenders: Array<string> = []
    for (const workspace of workspaces.filter((candidate) => candidate.kind === "app")) {
      for (const file of await codeFiles(workspace, ["src"])) {
        if (forbidden.test(await Bun.file(file).text())) {
          offenders.push(display(file))
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
