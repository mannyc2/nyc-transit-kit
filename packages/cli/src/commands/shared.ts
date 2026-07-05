// biome-ignore-all format: first-wave CLI compression budget
import { releaseVersion, schemaVersion } from "@nyc-transit-kit/contracts/metadata"
import type { Soda3ExportFormat } from "@nyc-transit-kit/contracts/soda3"
import type { GtfsRealtimeDecoder } from "@nyc-transit-kit/mta/gtfs-realtime"
import type { Soda3ClientConfig } from "@nyc-transit-kit/soda3/client"
import { buildExportUrl, buildQueryUrl } from "@nyc-transit-kit/soda3/endpoints"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import { buildCommit, buildTarget } from "../build-info"
import { atomicWrite } from "../files"

export const packageVersion = releaseVersion
export const packageBuildCommit = buildCommit
export const packageBuildTarget = buildTarget
export type ApiFamily = "socrata" | "mta" | "nyc-open-data" | "nyc-dot" | "cli"
const meta = (apiFamily: ApiFamily) => ({ apiFamily, generatedAt: new Date().toISOString(), schemaVersion })
export const successEnvelope = (apiFamily: ApiFamily, data: unknown) => ({ ok: true, data, meta: meta(apiFamily) })
export const errorEnvelope = (apiFamily: ApiFamily, error: { readonly code: string; readonly message: string; readonly provider?: string; readonly retryable?: boolean; readonly command?: string }) => ({ ok: false, error, meta: meta(apiFamily) })
export type CliRuntime = { readonly soda3Layer: Layer.Layer<Soda3ClientConfig | HttpClient.HttpClient>; readonly mtaLayer: Layer.Layer<HttpClient.HttpClient>; readonly mtaRealtimeLayer: Layer.Layer<HttpClient.HttpClient | GtfsRealtimeDecoder> }
export type CommandContext = { readonly runtime: CliRuntime; readonly writeJson: (output: unknown) => void }
export class CliCommandContext extends Context.Service<CliCommandContext, CommandContext>()("@nyc-transit-kit/cli/CliCommandContext") {}

type DryRunExtra = Readonly<Record<string, unknown>>
const flag = (name: string, description: string) => Flag.string(name).pipe(Flag.withDescription(description))
export const dryRunFlag = Flag.boolean("dry-run").pipe(Flag.withDescription("Print the planned request without contacting the provider."))
export const outputFlag = flag("output", "Destination file path for the downloaded response body.")
export const selectFlag = flag("select", "SoQL select expression or full SELECT query.")
export const domainFlag = flag("domain", "Socrata domain without protocol, such as data.cityofnewyork.us.")
export const formatFlag = Flag.choice("format", ["csv", "json", "geojson"]).pipe(Flag.withDefault("csv"), Flag.withDescription("Export format. Defaults to csv."))
export const writeJson = (output: unknown) => console.log(JSON.stringify(output))
export const commandLabel = (tokens: ReadonlyArray<string>) => (tokens.length > 0 ? tokens.join(" ") : "(missing command)")
export const apiFamilyFor = (tokens: ReadonlyArray<string>): ApiFamily => tokens[0] === "socrata" || tokens[0] === "catalog" ? "socrata" : tokens[0] === "mta" || tokens[0] === "nyc-open-data" || tokens[0] === "nyc-dot" ? tokens[0] : "cli"
export const failCommand = (context: CommandContext, apiFamily: ApiFamily, code: string, message: string, tokens: ReadonlyArray<string>, options?: { readonly provider?: string; readonly retryable?: boolean }) =>
  Effect.sync(() => {
    process.exitCode = 1
    context.writeJson(errorEnvelope(apiFamily, { code, message, provider: options?.provider, retryable: options?.retryable, command: commandLabel(tokens) }))
  })
export const writeSuccess = (context: CommandContext, apiFamily: ApiFamily, data: unknown) => Effect.sync(() => context.writeJson(successEnvelope(apiFamily, data)))
export const missingOption = (context: CommandContext, tokens: ReadonlyArray<string>, option: string) => failCommand(context, apiFamilyFor(tokens), "missing-option", `Missing required option --${option}.`, tokens)
export const soqlFromSelect = (select: string) => select.trim().toUpperCase().startsWith("SELECT ") ? select : `SELECT ${select}`
export const fileWriteError = (cause: unknown) => ({ _tag: "FileWriteError", message: cause instanceof Error ? cause.message : "File write failed." })
const field = (error: unknown, name: "_tag" | "message") => {
  if (typeof error !== "object" || error === null) return undefined
  if (name === "_tag" && "_tag" in error && typeof error._tag === "string") return error._tag
  if (name === "message" && "message" in error && typeof error.message === "string") return error.message
  return undefined
}
const taggedMessage = (error: unknown) => field(error, "message") ?? "Command failed."
const taggedCode = (error: unknown) => field(error, "_tag")?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase() ?? "command-failed"
export const runEffect = <A>(context: CommandContext, apiFamily: ApiFamily, tokens: ReadonlyArray<string>, effect: Effect.Effect<A, unknown>) =>
  effect.pipe(Effect.matchEffect({ onFailure: (error) => failCommand(context, apiFamily, taggedCode(error), taggedMessage(error), tokens), onSuccess: (data) => writeSuccess(context, apiFamily, data) }))

type QueryDryRun = { readonly context: CommandContext; readonly apiFamily: ApiFamily; readonly tokens: ReadonlyArray<string>; readonly domain: string; readonly datasetId: string; readonly query: string; readonly extra?: DryRunExtra }
type ExportDryRun = { readonly context: CommandContext; readonly apiFamily: ApiFamily; readonly tokens: ReadonlyArray<string>; readonly domain: string; readonly datasetId: string; readonly format: Soda3ExportFormat; readonly output: string; readonly extra?: DryRunExtra }
export const writeSoda3QueryDryRun = (config: QueryDryRun) =>
  runEffect(config.context, config.apiFamily, config.tokens, buildQueryUrl({ domain: config.domain, datasetId: config.datasetId, query: config.query }).pipe(Effect.map((url) => ({ dryRun: true, method: "POST", url: url.toString(), ...config.extra, body: { query: config.query } }))))
export const writeSoda3ExportDryRun = (config: ExportDryRun) =>
  runEffect(config.context, config.apiFamily, config.tokens, buildExportUrl({ domain: config.domain, datasetId: config.datasetId, format: config.format }).pipe(Effect.map((url) => ({ dryRun: true, method: "POST", url: url.toString(), ...config.extra, output: config.output }))))

const contentLengthOf = (headers: Headers) => {
  const parsed = Number(headers.get("content-length") ?? undefined)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}
export const writeResponseToFile = (output: string, response: Response) =>
  Effect.gen(function* () {
    const contentType = response.headers.get("content-type") ?? undefined
    const contentLength = contentLengthOf(response.headers)
    yield* Effect.tryPromise({ try: () => atomicWrite(output, response), catch: fileWriteError })
    return { output, status: response.status, byteLength: yield* Effect.sync(() => Bun.file(output).size), ...(contentType === undefined ? {} : { contentType }), ...(contentLength === undefined ? {} : { contentLength }) }
  })

type DatasetIdConfig = { readonly datasetId: string } | { readonly name: string }
type DatasetLookup<A> = { readonly payload: A } | { readonly failure: { readonly code: string; readonly message: string } }
type DatasetResolution = DatasetLookup<{ readonly datasetId: string; readonly extra?: DryRunExtra }>
type DatasetEffect<A> = Effect.Effect<A, unknown, Soda3ClientConfig | HttpClient.HttpClient>
export type DatasetCliFamily = { readonly family: ApiFamily; readonly tokens: ReadonlyArray<string>; readonly idConfigKey: "datasetId" | "name"; readonly idFlagName: string; readonly idFlagDescription: string; readonly domain: string; readonly listShortDescription: string; readonly infoShortDescription: string; readonly queryShortDescription: string; readonly exportShortDescription?: string; readonly listPayload: () => unknown; readonly infoPayload: (id: string) => DatasetLookup<unknown>; readonly resolveDataset: (id: string) => DatasetResolution; readonly query: (input: { readonly id: string; readonly query: string }) => DatasetEffect<unknown>; readonly exportResponse?: (input: { readonly id: string; readonly format: Soda3ExportFormat }) => DatasetEffect<Response> }
const datasetIdentifier = (config: DatasetIdConfig) => ("datasetId" in config ? config.datasetId : config.name)
const withShort = <C extends Command.Command.Any>(command: C, description: string) => command.pipe(Command.withShortDescription(description))

export const makeDatasetCommands = (spec: DatasetCliFamily): ReadonlyArray<Command.Command.Any> => {
  const listCommand = withShort(Command.make("list", {}, () => Effect.gen(function* () { const context = yield* CliCommandContext; return yield* writeSuccess(context, spec.family, spec.listPayload()) })), spec.listShortDescription)
  const handleInfo = (config: DatasetIdConfig) => Effect.gen(function* () { const context = yield* CliCommandContext; const result = spec.infoPayload(datasetIdentifier(config)); return yield* "failure" in result ? failCommand(context, spec.family, result.failure.code, result.failure.message, [...spec.tokens, "info"]) : writeSuccess(context, spec.family, result.payload) })
  const idFlag = flag(spec.idFlagName, spec.idFlagDescription)
  const infoCommand = spec.idConfigKey === "datasetId" ? withShort(Command.make("info", { datasetId: idFlag }, handleInfo), spec.infoShortDescription) : withShort(Command.make("info", { name: idFlag }, handleInfo), spec.infoShortDescription)
  const handleQuery = (config: DatasetIdConfig & { readonly select: string; readonly dryRun: boolean }) => Effect.gen(function* () {
    const context = yield* CliCommandContext; const id = datasetIdentifier(config); const tokens = [...spec.tokens, "query"]; const query = soqlFromSelect(config.select); const resolution = spec.resolveDataset(id)
    if ("failure" in resolution) return yield* failCommand(context, spec.family, resolution.failure.code, resolution.failure.message, tokens)
    return yield* config.dryRun ? writeSoda3QueryDryRun({ context, apiFamily: spec.family, tokens, domain: spec.domain, datasetId: resolution.payload.datasetId, query, extra: resolution.payload.extra }) : runEffect(context, spec.family, tokens, spec.query({ id, query }).pipe(Effect.provide(context.runtime.soda3Layer)))
  })
  const queryCommand = spec.idConfigKey === "datasetId" ? withShort(Command.make("query", { datasetId: idFlag, select: selectFlag, dryRun: dryRunFlag }, handleQuery), spec.queryShortDescription) : withShort(Command.make("query", { name: idFlag, select: selectFlag, dryRun: dryRunFlag }, handleQuery), spec.queryShortDescription)
  const exportResponse = spec.exportResponse
  if (exportResponse === undefined) return [listCommand, infoCommand, queryCommand]
  const handleExport = (config: DatasetIdConfig & { readonly format: Soda3ExportFormat; readonly output: string; readonly dryRun: boolean }) => Effect.gen(function* () {
    const context = yield* CliCommandContext; const id = datasetIdentifier(config); const tokens = [...spec.tokens, "export"]; const resolution = spec.resolveDataset(id)
    if ("failure" in resolution) return yield* failCommand(context, spec.family, resolution.failure.code, resolution.failure.message, tokens)
    return yield* config.dryRun ? writeSoda3ExportDryRun({ context, apiFamily: spec.family, tokens, domain: spec.domain, datasetId: resolution.payload.datasetId, format: config.format, output: config.output, extra: resolution.payload.extra }) : runEffect(context, spec.family, tokens, exportResponse({ id, format: config.format }).pipe(Effect.provide(context.runtime.soda3Layer), Effect.flatMap((response) => writeResponseToFile(config.output, response))))
  })
  const exportCommand = spec.idConfigKey === "datasetId" ? withShort(Command.make("export", { datasetId: idFlag, format: formatFlag, output: outputFlag, dryRun: dryRunFlag }, handleExport), spec.exportShortDescription ?? "Export a dataset.") : withShort(Command.make("export", { name: idFlag, format: formatFlag, output: outputFlag, dryRun: dryRunFlag }, handleExport), spec.exportShortDescription ?? "Export a dataset.")
  return [listCommand, infoCommand, queryCommand, exportCommand]
}
