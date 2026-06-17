import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"

type JsonRecord = Record<string, unknown>

const rootPath = new URL("../", import.meta.url).pathname
const args = Bun.argv.slice(2)

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readJsonRecord = async (path: string) => {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(parsed)) {
    throw new Error(`${path} did not contain a JSON object`)
  }
  return parsed
}

const writeJson = async (path: string, value: JsonRecord) => {
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`)
}

const streamText = async (stream: ReadableStream<Uint8Array> | null) =>
  stream === null ? "" : await new Response(stream).text()

const hasGitDirectory = async () => Bun.file(join(rootPath, ".git")).exists()

const resolveCliPath = async () => {
  const envPath = process.env.TS_RELEASE_CLI
  if (envPath !== undefined && envPath.length > 0) {
    return envPath
  }
  const localBin = join(rootPath, "node_modules/.bin/release")
  if (await Bun.file(localBin).exists()) {
    return localBin
  }
  console.error(
    "Unable to find ts-release. Run bun install to install @mannyc1/ts-release, or set TS_RELEASE_CLI to a built release CLI."
  )
  process.exit(1)
}

const configArgIndex = args.indexOf("--config")

if (
  (args[0] === "plan" || args[0] === "print") &&
  configArgIndex >= 0 &&
  args[configArgIndex + 1] !== undefined &&
  !(await hasGitDirectory())
) {
  const configPath = args[configArgIndex + 1]
  const config = await readJsonRecord(join(rootPath, configPath))
  if (isRecord(config.identity) && config.identity.commit === "HEAD") {
    config.identity = {
      ...config.identity,
      commit: "unknown"
    }
    const localConfigPath = ".release/generated/release.local.config.json"
    await writeJson(join(rootPath, localConfigPath), config)
    args[configArgIndex + 1] = localConfigPath
  }
}

const cliPath = await resolveCliPath()
const proc = Bun.spawn(["bun", cliPath, ...args], {
  cwd: rootPath,
  stderr: "pipe",
  stdout: "pipe"
})
const stdout = await streamText(proc.stdout)
const stderr = await streamText(proc.stderr)
const exitCode = await proc.exited

if (stdout.length > 0) {
  process.stdout.write(stdout)
}
if (stderr.length > 0) {
  process.stderr.write(stderr)
}

process.exitCode = exitCode
