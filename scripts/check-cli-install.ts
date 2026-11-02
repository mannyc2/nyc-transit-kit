/**
 * Installs the staged CLI the way a user does, from its tarball with no
 * lockfile, and runs `ntk --version --json`. The workspace lockfile pins every
 * transitive version, so only a fresh install shows what a user gets. 0.3.0
 * passed every other check and still crashed here: `@effect/platform-bun` 4.0.6
 * asks for `@effect/platform-node-shared` `^4.0.6`, which by then resolved to a
 * version built for Effect 4.1.
 *
 * The staged libraries stand in for their unpublished versions through
 * `overrides`; everything else comes from npm. The install runs outside the
 * repository, so nothing can resolve from the workspace's `node_modules`.
 *
 * Fails when the install fails, when it holds more than one `effect`, when an
 * installed package's `effect` peer range rejects the installed `effect`, or
 * when `ntk` does not start.
 */
import { existsSync } from "node:fs"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { rootPath } from "./workspaces"

interface Manifest {
  readonly name: string
  readonly version: string
  readonly peerDependencies?: Readonly<Record<string, string>>
}

const stageRoot = join(rootPath, ".release/npm")
const artifactsRoot = join(rootPath, ".release/artifacts")

const readManifest = (directory: string): Promise<Manifest> =>
  Bun.file(join(directory, "package.json")).json()

/** The tarball `prepare-npm-release` packed for a staged package. */
const tarball = ({ name, version }: Manifest) =>
  `file:${join(artifactsRoot, `${name.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`)}`

/** Every installed package directory, scoped and nested ones included. */
const packageDirectories = async (nodeModules: string): Promise<Array<string>> => {
  if (!existsSync(nodeModules)) {
    return []
  }
  const found: Array<string> = []
  for (const entry of await readdir(nodeModules, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || !(entry.isDirectory() || entry.isSymbolicLink())) {
      continue
    }
    const path = join(nodeModules, entry.name)
    const directories = entry.name.startsWith("@")
      ? (await readdir(path)).map((name) => join(path, name))
      : [path]
    for (const directory of directories) {
      found.push(directory, ...(await packageDirectories(join(directory, "node_modules"))))
    }
  }
  return found
}

const run = (command: ReadonlyArray<string>, cwd: string) => {
  const result = Bun.spawnSync([...command], { cwd, stdout: "pipe", stderr: "pipe" })
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim()
  }
}

/** Bun prints a code frame before the error, so report the error line. */
const errorLine = (stderr: string) =>
  stderr.split("\n").find((line) => /error/i.test(line)) ?? stderr

const staged = await Promise.all(
  (await readdir(stageRoot)).map((directory) => readManifest(join(stageRoot, directory)))
)
const cli = staged.find((manifest) => manifest.name === "@nyc-transit-kit/cli")
if (cli === undefined) {
  console.error("the staged CLI is missing; run bun run release:prepare:npm")
  process.exit(1)
}

const failures: Array<string> = []
const directory = await mkdtemp(join(tmpdir(), "ntk-cli-install-"))
try {
  await Bun.write(
    join(directory, "package.json"),
    JSON.stringify({
      name: "cli-install-check",
      private: true,
      dependencies: { [cli.name]: tarball(cli) },
      overrides: Object.fromEntries(
        staged
          .filter((manifest) => manifest !== cli)
          .map((manifest) => [manifest.name, tarball(manifest)])
      )
    })
  )
  // Hoisted, so every installed package is a directory under node_modules to read.
  const install = run(["bun", "install", "--linker", "hoisted"], directory)
  if (install.exitCode !== 0) {
    failures.push(`bun install failed: ${errorLine(install.stderr)}`)
  } else {
    const nodeModules = join(directory, "node_modules")
    const installed = await Promise.all((await packageDirectories(nodeModules)).map(readManifest))
    const effects = installed.filter((manifest) => manifest.name === "effect")
    const effect = effects[0]?.version ?? "missing"
    if (effects.length !== 1) {
      failures.push(
        `the install holds ${effects.length} copies of effect: ${effects.map((manifest) => manifest.version).join(", ")}`
      )
    }
    for (const manifest of installed) {
      const range = manifest.peerDependencies?.effect
      if (range !== undefined && !Bun.semver.satisfies(effect, range)) {
        failures.push(
          `${manifest.name}@${manifest.version} needs effect ${range}, but the CLI installs effect ${effect}`
        )
      }
    }
    const ntk = run([join(nodeModules, ".bin/ntk"), "--version", "--json"], directory)
    if (ntk.exitCode !== 0) {
      failures.push(`ntk --version --json failed: ${errorLine(ntk.stderr)}`)
    } else if (!ntk.stdout.includes(`"version":"${cli.version}"`)) {
      failures.push(`ntk --version --json did not report ${cli.version}: ${ntk.stdout}`)
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exit(1)
}

console.log(`CLI fresh install check passed: ${cli.name}@${cli.version} starts.`)
