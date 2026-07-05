// biome-ignore-all format: first-wave CLI compression budget
import { type GtfsFeedKind, MtaGtfsRealtimeCaptureManifest } from "@nyc-transit-kit/contracts/mta"
import { findMtaGtfsRealtimeFeed, findMtaGtfsStaticFeed, type MtaGtfsRealtimeFeedDescriptor, type MtaGtfsStaticFeedDescriptor, mtaGtfsRealtimeFeeds, mtaGtfsStaticFeeds } from "@nyc-transit-kit/mta/feeds"
import { captureGtfsRealtime, probeGtfsRealtime } from "@nyc-transit-kit/mta/gtfs-realtime"
import { fetchGtfsStaticResponse, probeGtfsStatic } from "@nyc-transit-kit/mta/gtfs-static"
import { findMtaOpenDataDataset, mtaOpenDataDatasets, mtaOpenDataDomain, queryMtaOpenData } from "@nyc-transit-kit/mta/open-data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { atomicWriteGroup } from "../files"
import { CliCommandContext, type CommandContext, dryRunFlag, failCommand, fileWriteError, makeDatasetCommands, missingOption, outputFlag, runEffect, writeResponseToFile, writeSuccess } from "./shared"

type StaticFeedTarget = { readonly _tag: "Resolved"; readonly url: string; readonly source: "descriptor" | "url"; readonly descriptor?: MtaGtfsStaticFeedDescriptor } | { readonly _tag: "Missing" } | { readonly _tag: "Unsupported"; readonly feed: string }
type RealtimeFeedTarget = { readonly _tag: "Resolved"; readonly feed: GtfsFeedKind; readonly url: string; readonly source: "descriptor" | "url"; readonly descriptor?: MtaGtfsRealtimeFeedDescriptor } | { readonly _tag: "MissingUrl"; readonly feed: GtfsFeedKind } | { readonly _tag: "Unsupported"; readonly feed: string }
const gtfsFeedKinds = new Set(["vehicle-positions", "trip-updates", "alerts"])
const optionalString = (value: Option.Option<string>) => Option.getOrUndefined(value)
const isGtfsFeedKind = (value: string): value is GtfsFeedKind => gtfsFeedKinds.has(value)

const resolveStaticFeedTarget = (feed: Option.Option<string>, url: Option.Option<string>): StaticFeedTarget => {
  const feedKey = optionalString(feed), urlOverride = optionalString(url), descriptor = feedKey === undefined ? undefined : findMtaGtfsStaticFeed(feedKey)
  if (urlOverride !== undefined) return { _tag: "Resolved", url: urlOverride, source: "url", ...(descriptor === undefined ? {} : { descriptor }) }
  if (feedKey === undefined) return { _tag: "Missing" }
  return descriptor === undefined ? { _tag: "Unsupported", feed: feedKey } : { _tag: "Resolved", url: descriptor.url, source: "descriptor", descriptor }
}
const resolveRealtimeFeedTarget = (feedKey: string, url: Option.Option<string>): RealtimeFeedTarget => {
  const urlOverride = optionalString(url), descriptor = findMtaGtfsRealtimeFeed(feedKey)
  if (descriptor !== undefined) return { _tag: "Resolved", feed: descriptor.feed, url: urlOverride ?? descriptor.url, source: urlOverride === undefined ? "descriptor" : "url", descriptor }
  if (!isGtfsFeedKind(feedKey)) return { _tag: "Unsupported", feed: feedKey }
  return urlOverride === undefined ? { _tag: "MissingUrl", feed: feedKey } : { _tag: "Resolved", feed: feedKey, url: urlOverride, source: "url" }
}
const failStaticTarget = (context: CommandContext, tokens: ReadonlyArray<string>, target: StaticFeedTarget) =>
  target._tag === "Missing" ? missingOption(context, tokens, "feed") : target._tag === "Unsupported" ? failCommand(context, "mta", "unsupported-feed", `Unsupported MTA GTFS static feed: ${target.feed}`, tokens) : Effect.void
const failRealtimeTarget = (context: CommandContext, tokens: ReadonlyArray<string>, target: RealtimeFeedTarget) =>
  target._tag === "MissingUrl" ? missingOption(context, tokens, "url") : target._tag === "Unsupported" ? failCommand(context, "mta", "unsupported-feed", `Unsupported MTA GTFS realtime feed: ${target.feed}`, tokens) : Effect.void
const feedTargetPayload = (target: { readonly url: string; readonly source: "descriptor" | "url"; readonly descriptor?: unknown }) => ({ url: target.url, source: target.source, descriptor: target.descriptor })
const feedListHandler = (feeds: unknown) => () => Effect.gen(function* () { const context = yield* CliCommandContext; return yield* writeSuccess(context, "mta", { feeds }) })

const handleMtaGtfsStaticProbe = (config: { readonly feed: Option.Option<string>; readonly url: Option.Option<string>; readonly dryRun: boolean }) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext, tokens = ["mta", "gtfs-static", "probe"], target = resolveStaticFeedTarget(config.feed, config.url)
    if (target._tag !== "Resolved") return yield* failStaticTarget(context, tokens, target)
    return yield* config.dryRun ? writeSuccess(context, "mta", { dryRun: true, method: "HEAD", ...feedTargetPayload(target) }) : runEffect(context, "mta", tokens, probeGtfsStatic({ url: target.url }).pipe(Effect.provide(context.runtime.mtaLayer)))
  })
const handleMtaGtfsStaticFetch = (config: { readonly feed: Option.Option<string>; readonly url: Option.Option<string>; readonly output: string; readonly dryRun: boolean }) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext, tokens = ["mta", "gtfs-static", "fetch"], target = resolveStaticFeedTarget(config.feed, config.url)
    if (target._tag !== "Resolved") return yield* failStaticTarget(context, tokens, target)
    return yield* config.dryRun ? writeSuccess(context, "mta", { dryRun: true, method: "GET", output: config.output, ...feedTargetPayload(target) }) : runEffect(context, "mta", tokens, Effect.gen(function* () { const response = yield* fetchGtfsStaticResponse({ url: target.url }).pipe(Effect.provide(context.runtime.mtaLayer)); return yield* writeResponseToFile(config.output, response) }))
  })
const runMtaGtfsRealtimeRequest = (tokens: ReadonlyArray<string>, config: { readonly feed: string; readonly url: Option.Option<string>; readonly dryRun: boolean }) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext, target = resolveRealtimeFeedTarget(config.feed, config.url)
    if (target._tag !== "Resolved") return yield* failRealtimeTarget(context, tokens, target)
    return yield* config.dryRun ? writeSuccess(context, "mta", { dryRun: true, method: "GET", feed: target.feed, ...feedTargetPayload(target) }) : runEffect(context, "mta", tokens, probeGtfsRealtime({ feed: target.feed, url: target.url }).pipe(Effect.provide(context.runtime.mtaRealtimeLayer)))
  })
const handleMtaGtfsRealtimeProbe = (config: { readonly feed: string; readonly url: Option.Option<string>; readonly dryRun: boolean }) => runMtaGtfsRealtimeRequest(["mta", "gtfs-rt", "probe"], config)
const handleMtaGtfsRealtimeDecode = (config: { readonly feed: string; readonly url: Option.Option<string>; readonly dryRun: boolean }) => runMtaGtfsRealtimeRequest(["mta", "gtfs-rt", "decode"], config)
const handleMtaGtfsRealtimeCapture = (config: { readonly feed: string; readonly url: Option.Option<string>; readonly output: string; readonly manifestOutput: string; readonly dryRun: boolean }) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext, tokens = ["mta", "gtfs-rt", "capture"], target = resolveRealtimeFeedTarget(config.feed, config.url)
    if (target._tag !== "Resolved") return yield* failRealtimeTarget(context, tokens, target)
    if (config.dryRun) return yield* writeSuccess(context, "mta", { dryRun: true, method: "GET", feed: target.feed, output: config.output, manifestOutput: config.manifestOutput, ...feedTargetPayload(target) })
    return yield* runEffect(context, "mta", tokens, Effect.gen(function* () {
      const result = yield* captureGtfsRealtime({ feed: target.feed, url: target.url }).pipe(Effect.provide(context.runtime.mtaRealtimeLayer))
      const manifest = MtaGtfsRealtimeCaptureManifest.make({ feed: result.feed, status: result.status, byteLength: result.byteLength, sha256: result.sha256, capturedAt: result.capturedAt, url: result.url })
      yield* Effect.tryPromise({ try: () => atomicWriteGroup([{ path: config.output, body: result.bytes }, { path: config.manifestOutput, body: `${JSON.stringify(manifest, null, 2)}\n` }]), catch: fileWriteError })
      return { output: config.output, manifestOutput: config.manifestOutput, manifest }
    }))
  })

const feedFlagDescription = "Known feed id/name. Use --url with vehicle-positions, trip-updates, or alerts for manual URLs."
const optionalFeedFlag = Flag.optional(Flag.string("feed").pipe(Flag.withDescription("Known feed id/name.")))
const optionalUrlFlag = Flag.optional(Flag.string("url").pipe(Flag.withDescription("Manual provider URL override.")))
const realtimeFeedFlag = Flag.string("feed").pipe(Flag.withDescription(feedFlagDescription))
const realtimeRequestCommand = (name: "probe" | "decode", description: string, handler: (config: { readonly feed: string; readonly url: Option.Option<string>; readonly dryRun: boolean }) => Effect.Effect<void, never, CliCommandContext>) =>
  Command.make(name, { feed: realtimeFeedFlag, url: optionalUrlFlag, dryRun: dryRunFlag }, handler).pipe(Command.withShortDescription(description))

const mtaOpenDataDatasetCommands = makeDatasetCommands({
  family: "mta", tokens: ["mta", "open-data", "dataset"], idConfigKey: "datasetId", idFlagName: "dataset", idFlagDescription: "MTA Open Data Socrata dataset id.", domain: mtaOpenDataDomain,
  listShortDescription: "List curated MTA Open Data descriptors.", infoShortDescription: "Show MTA Open Data dataset metadata.", queryShortDescription: "Run an MTA Open Data SODA3 query.",
  listPayload: () => ({ datasets: mtaOpenDataDatasets }),
  infoPayload: (datasetId) => { const descriptor = findMtaOpenDataDataset(datasetId); return { payload: { known: descriptor !== undefined, descriptor: descriptor === undefined ? { id: datasetId, domain: mtaOpenDataDomain, backing: "socrata" } : descriptor } } },
  resolveDataset: (datasetId) => ({ payload: { datasetId, extra: { known: findMtaOpenDataDataset(datasetId) !== undefined } } }),
  query: ({ id, query }) => queryMtaOpenData({ datasetId: id, query })
})
const mtaOpenDataDatasetCommand = Command.make("dataset").pipe(Command.withShortDescription("MTA Open Data dataset commands."), Command.withSubcommands(mtaOpenDataDatasetCommands))
const mtaOpenDataCommand = Command.make("open-data").pipe(Command.withShortDescription("MTA Open Data commands."), Command.withSubcommands([mtaOpenDataDatasetCommand]))
const mtaGtfsStaticListCommand = Command.make("list", {}, feedListHandler(mtaGtfsStaticFeeds)).pipe(Command.withShortDescription("List known MTA GTFS static feed descriptors."))
const mtaGtfsStaticProbeCommand = Command.make("probe", { feed: optionalFeedFlag, url: optionalUrlFlag, dryRun: dryRunFlag }, handleMtaGtfsStaticProbe).pipe(Command.withShortDescription("Probe an MTA GTFS static feed."))
const mtaGtfsStaticFetchCommand = Command.make("fetch", { feed: optionalFeedFlag, url: optionalUrlFlag, output: outputFlag, dryRun: dryRunFlag }, handleMtaGtfsStaticFetch).pipe(Command.withShortDescription("Fetch an MTA GTFS static file."))
const mtaGtfsStaticCommand = Command.make("gtfs-static").pipe(Command.withShortDescription("MTA GTFS static commands."), Command.withSubcommands([mtaGtfsStaticListCommand, mtaGtfsStaticProbeCommand, mtaGtfsStaticFetchCommand]))
const mtaGtfsRealtimeListCommand = Command.make("list", {}, feedListHandler(mtaGtfsRealtimeFeeds)).pipe(Command.withShortDescription("List known MTA GTFS realtime feed descriptors."))
const mtaGtfsRealtimeProbeCommand = realtimeRequestCommand("probe", "Probe an MTA GTFS realtime feed.", handleMtaGtfsRealtimeProbe)
const mtaGtfsRealtimeDecodeCommand = realtimeRequestCommand("decode", "Fetch and decode an MTA GTFS realtime feed.", handleMtaGtfsRealtimeDecode)
const mtaGtfsRealtimeCaptureCommand = Command.make("capture", { feed: realtimeFeedFlag, url: optionalUrlFlag, output: Flag.string("output").pipe(Flag.withDescription("Destination file path for the raw GTFS realtime protobuf bytes.")), manifestOutput: Flag.string("manifest-output").pipe(Flag.withDescription("Destination file path for the capture manifest JSON.")), dryRun: dryRunFlag }, handleMtaGtfsRealtimeCapture).pipe(Command.withShortDescription("Capture raw MTA GTFS realtime bytes and a manifest."))
const mtaGtfsRealtimeCommand = Command.make("gtfs-rt").pipe(Command.withShortDescription("MTA GTFS realtime commands."), Command.withSubcommands([mtaGtfsRealtimeListCommand, mtaGtfsRealtimeProbeCommand, mtaGtfsRealtimeDecodeCommand, mtaGtfsRealtimeCaptureCommand]))
export const mtaCommand = Command.make("mta").pipe(Command.withShortDescription("MTA data commands."), Command.withSubcommands([mtaOpenDataCommand, mtaGtfsStaticCommand, mtaGtfsRealtimeCommand]))
