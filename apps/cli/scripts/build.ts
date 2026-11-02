// Compiles `ntk` into one executable for this machine and writes its release manifest.
// Run from the repository root: `bun run build:cli`.
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import * as Schema from "effect/Schema"
import * as BuildInfo from "../src/BuildInfo"
import { schemaVersion } from "../src/Envelope"
import { Architecture, Artifact, Platform, ReleaseManifest } from "../src/ReleaseManifest"

const binaryPath = "dist/ntk"
const manifestPath = "dist/ntk-release-manifest.json"

const platform = Schema.decodeUnknownOption(Platform)(process.platform)
const arch = Schema.decodeUnknownOption(Architecture)(process.arch)
if (platform._tag === "None" || arch._tag === "None") {
  console.error(`Unsupported release target: ${process.platform}/${process.arch}`)
  process.exit(1)
}

const git = Bun.spawnSync(["git", "rev-parse", "HEAD"], { stderr: "pipe", stdout: "pipe" })
const commit = git.success ? git.stdout.toString().trim() : "unknown"
const buildTarget = `${platform.value}-${arch.value}`

await mkdir("dist", { recursive: true })
const result = await Bun.build({
  entrypoints: [join(import.meta.dir, "../src/bin.ts")],
  define: {
    "process.env.NTK_BUILD_COMMIT": JSON.stringify(commit),
    "process.env.NTK_BUILD_TARGET": JSON.stringify(buildTarget)
  },
  compile: { outfile: binaryPath }
})
if (!result.success) {
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

const binary = Bun.file(binaryPath)
const manifest = ReleaseManifest.make({
  manifestVersion: 1,
  packageName: "@nyc-transit-kit/cli",
  version: BuildInfo.version,
  schemaVersion,
  schemaCommit: commit,
  generatedSourceCommit: commit,
  builtAt: new Date().toISOString(),
  artifacts: [
    Artifact.make({
      platform: platform.value,
      arch: arch.value,
      url: pathToFileURL(join(process.cwd(), binaryPath)).href,
      sha256: new Bun.CryptoHasher("sha256").update(await binary.arrayBuffer()).digest("hex"),
      size: binary.size,
      signed: false
    })
  ]
})
await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`Built ${binaryPath}`)
console.log(`Wrote ${manifestPath}`)
