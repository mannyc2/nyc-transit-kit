import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { releaseVersion, schemaVersion } from "@nyc-transit-kit/contracts/metadata"
import { CliReleaseArtifact, CliReleaseManifest } from "@nyc-transit-kit/contracts/release"
import * as Schema from "effect/Schema"

const binaryPath = "dist/ntk"
const manifestPath = "dist/ntk-release-manifest.json"

const releasePlatform = () => {
  switch (process.platform) {
    case "darwin":
      return "darwin"
    case "linux":
      return "linux"
    case "win32":
      return "win32"
    default:
      return undefined
  }
}

const releaseArchitecture = () => {
  switch (process.arch) {
    case "arm64":
      return "arm64"
    case "x64":
      return "x64"
    default:
      return undefined
  }
}

const currentCommit = () => {
  const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
    stderr: "pipe",
    stdout: "pipe"
  })

  if (!result.success) {
    return "unknown"
  }

  return result.stdout.toString().trim()
}

const sha256 = async (path: string) => {
  const digest = await crypto.subtle.digest("SHA-256", await Bun.file(path).arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

await mkdir("dist", { recursive: true })

const platform = releasePlatform()
const arch = releaseArchitecture()

if (platform === undefined || arch === undefined) {
  console.error(`Unsupported release target: ${process.platform}/${process.arch}`)
  process.exit(1)
}

const commit = currentCommit()
const buildTarget = `${platform}-${arch}`
const result = await Bun.build({
  entrypoints: ["packages/cli/src/main.ts"],
  define: {
    "process.env.NTK_BUILD_COMMIT": JSON.stringify(commit),
    "process.env.NTK_BUILD_TARGET": JSON.stringify(buildTarget)
  },
  compile: {
    outfile: binaryPath
  }
})

if (!result.success) {
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

const manifest = CliReleaseManifest.make({
  manifestVersion: 1,
  packageName: "@nyc-transit-kit/cli",
  version: releaseVersion,
  schemaVersion,
  schemaCommit: commit,
  generatedSourceCommit: commit,
  builtAt: new Date().toISOString(),
  artifacts: [
    CliReleaseArtifact.make({
      platform,
      arch,
      url: pathToFileURL(join(process.cwd(), binaryPath)).href,
      sha256: await sha256(binaryPath),
      size: Bun.file(binaryPath).size,
      signed: false
    })
  ]
})

if (!Schema.is(CliReleaseManifest)(manifest)) {
  console.error("Generated CLI release manifest failed schema validation.")
  process.exit(1)
}

await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`Built ${binaryPath}`)
console.log(`Wrote ${manifestPath}`)
