import { type GtfsFeedKind, MtaGtfsRealtimeCaptureManifest } from "@nyc-transit-kit/contracts/mta"
import {
  findMtaOpenDataDataset,
  mtaOpenDataDatasets,
  mtaOpenDataDomain
} from "@nyc-transit-kit/mta/datasets"
import {
  findMtaGtfsRealtimeFeed,
  findMtaGtfsStaticFeed,
  type MtaGtfsRealtimeFeedDescriptor,
  type MtaGtfsStaticFeedDescriptor,
  mtaGtfsRealtimeFeeds,
  mtaGtfsStaticFeeds
} from "@nyc-transit-kit/mta/feeds"
import { captureGtfsRealtime, probeGtfsRealtime } from "@nyc-transit-kit/mta/gtfs-realtime"
import { fetchGtfsStaticResponse, probeGtfsStatic } from "@nyc-transit-kit/mta/gtfs-static"
import { queryMtaOpenData } from "@nyc-transit-kit/mta/open-data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { atomicWriteGroup } from "../files"
import { failCommand, missingOption, runEffect, soqlFromSelect, writeSuccess } from "./shared"
import { fileWriteError, writeResponseToFile, writeSoda3QueryDryRun } from "./soda3-shared"
import { CliCommandContext, type CommandContext } from "./types"

export const mtaCommandPaths: ReadonlyArray<ReadonlyArray<string>> = [
  ["mta", "open-data", "dataset", "list"],
  ["mta", "open-data", "dataset", "info"],
  ["mta", "open-data", "dataset", "query"],
  ["mta", "gtfs-static", "list"],
  ["mta", "gtfs-static", "probe"],
  ["mta", "gtfs-static", "fetch"],
  ["mta", "gtfs-rt", "list"],
  ["mta", "gtfs-rt", "probe"],
  ["mta", "gtfs-rt", "decode"],
  ["mta", "gtfs-rt", "capture"]
]

type StaticFeedTarget =
  | {
      readonly _tag: "Resolved"
      readonly url: string
      readonly source: "descriptor" | "url"
      readonly descriptor?: MtaGtfsStaticFeedDescriptor
    }
  | {
      readonly _tag: "Missing"
    }
  | {
      readonly _tag: "Unsupported"
      readonly feed: string
    }

type RealtimeFeedTarget =
  | {
      readonly _tag: "Resolved"
      readonly feed: GtfsFeedKind
      readonly url: string
      readonly source: "descriptor" | "url"
      readonly descriptor?: MtaGtfsRealtimeFeedDescriptor
    }
  | {
      readonly _tag: "MissingUrl"
      readonly feed: GtfsFeedKind
    }
  | {
      readonly _tag: "Unsupported"
      readonly feed: string
    }

const gtfsFeedKinds = new Set(["vehicle-positions", "trip-updates", "alerts"])

const optionalString = (value: Option.Option<string>) => Option.getOrUndefined(value)

const isGtfsFeedKind = (value: string): value is GtfsFeedKind => gtfsFeedKinds.has(value)

const resolveStaticFeedTarget = (
  feed: Option.Option<string>,
  url: Option.Option<string>
): StaticFeedTarget => {
  const feedKey = optionalString(feed)
  const urlOverride = optionalString(url)
  const descriptor = feedKey === undefined ? undefined : findMtaGtfsStaticFeed(feedKey)

  if (urlOverride !== undefined) {
    return {
      _tag: "Resolved",
      url: urlOverride,
      source: "url",
      ...(descriptor === undefined ? {} : { descriptor })
    }
  }

  if (feedKey === undefined) {
    return { _tag: "Missing" }
  }

  if (descriptor === undefined) {
    return {
      _tag: "Unsupported",
      feed: feedKey
    }
  }

  return {
    _tag: "Resolved",
    url: descriptor.url,
    source: "descriptor",
    descriptor
  }
}

const resolveRealtimeFeedTarget = (
  feedKey: string,
  url: Option.Option<string>
): RealtimeFeedTarget => {
  const urlOverride = optionalString(url)
  const descriptor = findMtaGtfsRealtimeFeed(feedKey)

  if (descriptor !== undefined) {
    return {
      _tag: "Resolved",
      feed: descriptor.feed,
      url: urlOverride ?? descriptor.url,
      source: urlOverride === undefined ? "descriptor" : "url",
      descriptor
    }
  }

  if (isGtfsFeedKind(feedKey)) {
    if (urlOverride === undefined) {
      return {
        _tag: "MissingUrl",
        feed: feedKey
      }
    }

    return {
      _tag: "Resolved",
      feed: feedKey,
      url: urlOverride,
      source: "url"
    }
  }

  return {
    _tag: "Unsupported",
    feed: feedKey
  }
}

const failStaticTarget = (
  context: CommandContext,
  tokens: ReadonlyArray<string>,
  target: StaticFeedTarget
) => {
  switch (target._tag) {
    case "Missing":
      return missingOption(context, tokens, "feed")
    case "Unsupported":
      return failCommand(
        context,
        "mta",
        "unsupported-feed",
        `Unsupported MTA GTFS static feed: ${target.feed}`,
        tokens
      )
    case "Resolved":
      return Effect.void
  }
}

const failRealtimeTarget = (
  context: CommandContext,
  tokens: ReadonlyArray<string>,
  target: RealtimeFeedTarget
) => {
  switch (target._tag) {
    case "MissingUrl":
      return missingOption(context, tokens, "url")
    case "Unsupported":
      return failCommand(
        context,
        "mta",
        "unsupported-feed",
        `Unsupported MTA GTFS realtime feed: ${target.feed}`,
        tokens
      )
    case "Resolved":
      return Effect.void
  }
}

export const handleMtaOpenDataList = () =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    return yield* writeSuccess(context, "mta", {
      datasets: mtaOpenDataDatasets
    })
  })

export const handleMtaOpenDataInfo = (config: { readonly datasetId: string }) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const descriptor = findMtaOpenDataDataset(config.datasetId)

    return yield* writeSuccess(context, "mta", {
      known: descriptor !== undefined,
      descriptor:
        descriptor === undefined
          ? {
              id: config.datasetId,
              domain: mtaOpenDataDomain,
              backing: "socrata"
            }
          : descriptor
    })
  })

export const handleMtaOpenDataQuery = (config: {
  readonly datasetId: string
  readonly select: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["mta", "open-data", "dataset", "query"]
    const request = {
      datasetId: config.datasetId,
      query: soqlFromSelect(config.select)
    }

    if (config.dryRun) {
      return yield* writeSoda3QueryDryRun({
        context,
        apiFamily: "mta",
        tokens,
        domain: mtaOpenDataDomain,
        ...request,
        extra: {
          known: findMtaOpenDataDataset(config.datasetId) !== undefined
        }
      })
    }

    return yield* runEffect(
      context,
      "mta",
      tokens,
      queryMtaOpenData(request).pipe(Effect.provide(context.runtime.soda3Layer))
    )
  })

export const handleMtaGtfsStaticList = () =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    return yield* writeSuccess(context, "mta", {
      feeds: mtaGtfsStaticFeeds
    })
  })

export const handleMtaGtfsStaticProbe = (config: {
  readonly feed: Option.Option<string>
  readonly url: Option.Option<string>
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["mta", "gtfs-static", "probe"]
    const target = resolveStaticFeedTarget(config.feed, config.url)

    if (target._tag !== "Resolved") {
      return yield* failStaticTarget(context, tokens, target)
    }

    if (config.dryRun) {
      return yield* writeSuccess(context, "mta", {
        dryRun: true,
        method: "HEAD",
        url: target.url,
        source: target.source,
        descriptor: target.descriptor
      })
    }

    return yield* runEffect(
      context,
      "mta",
      tokens,
      probeGtfsStatic({ url: target.url }).pipe(Effect.provide(context.runtime.mtaLayer))
    )
  })

export const handleMtaGtfsStaticFetch = (config: {
  readonly feed: Option.Option<string>
  readonly url: Option.Option<string>
  readonly output: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["mta", "gtfs-static", "fetch"]
    const target = resolveStaticFeedTarget(config.feed, config.url)

    if (target._tag !== "Resolved") {
      return yield* failStaticTarget(context, tokens, target)
    }

    if (config.dryRun) {
      return yield* writeSuccess(context, "mta", {
        dryRun: true,
        method: "GET",
        url: target.url,
        output: config.output,
        source: target.source,
        descriptor: target.descriptor
      })
    }

    return yield* runEffect(
      context,
      "mta",
      tokens,
      Effect.gen(function* () {
        const response = yield* fetchGtfsStaticResponse({ url: target.url }).pipe(
          Effect.provide(context.runtime.mtaLayer)
        )
        return yield* writeResponseToFile(config.output, response)
      })
    )
  })

export const handleMtaGtfsRealtimeList = () =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    return yield* writeSuccess(context, "mta", {
      feeds: mtaGtfsRealtimeFeeds
    })
  })

const runMtaGtfsRealtimeRequest = (
  tokens: ReadonlyArray<string>,
  config: {
    readonly feed: string
    readonly url: Option.Option<string>
    readonly dryRun: boolean
  }
) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const target = resolveRealtimeFeedTarget(config.feed, config.url)

    if (target._tag !== "Resolved") {
      return yield* failRealtimeTarget(context, tokens, target)
    }

    if (config.dryRun) {
      return yield* writeSuccess(context, "mta", {
        dryRun: true,
        method: "GET",
        feed: target.feed,
        url: target.url,
        source: target.source,
        descriptor: target.descriptor
      })
    }

    return yield* runEffect(
      context,
      "mta",
      tokens,
      probeGtfsRealtime({ feed: target.feed, url: target.url }).pipe(
        Effect.provide(context.runtime.mtaRealtimeLayer)
      )
    )
  })

export const handleMtaGtfsRealtimeProbe = (config: {
  readonly feed: string
  readonly url: Option.Option<string>
  readonly dryRun: boolean
}) => runMtaGtfsRealtimeRequest(["mta", "gtfs-rt", "probe"], config)

export const handleMtaGtfsRealtimeDecode = (config: {
  readonly feed: string
  readonly url: Option.Option<string>
  readonly dryRun: boolean
}) => runMtaGtfsRealtimeRequest(["mta", "gtfs-rt", "decode"], config)

export const handleMtaGtfsRealtimeCapture = (config: {
  readonly feed: string
  readonly url: Option.Option<string>
  readonly output: string
  readonly manifestOutput: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["mta", "gtfs-rt", "capture"]
    const target = resolveRealtimeFeedTarget(config.feed, config.url)

    if (target._tag !== "Resolved") {
      return yield* failRealtimeTarget(context, tokens, target)
    }

    if (config.dryRun) {
      return yield* writeSuccess(context, "mta", {
        dryRun: true,
        method: "GET",
        feed: target.feed,
        url: target.url,
        output: config.output,
        manifestOutput: config.manifestOutput,
        source: target.source,
        descriptor: target.descriptor
      })
    }

    return yield* runEffect(
      context,
      "mta",
      tokens,
      Effect.gen(function* () {
        const result = yield* captureGtfsRealtime({
          feed: target.feed,
          url: target.url
        }).pipe(Effect.provide(context.runtime.mtaRealtimeLayer))
        const manifest = MtaGtfsRealtimeCaptureManifest.make({
          feed: result.feed,
          status: result.status,
          byteLength: result.byteLength,
          sha256: result.sha256,
          capturedAt: result.capturedAt,
          url: result.url
        })

        yield* Effect.tryPromise({
          try: () =>
            atomicWriteGroup([
              {
                path: config.output,
                body: result.bytes
              },
              {
                path: config.manifestOutput,
                body: `${JSON.stringify(manifest, null, 2)}\n`
              }
            ]),
          catch: fileWriteError
        })

        return {
          output: config.output,
          manifestOutput: config.manifestOutput,
          manifest
        }
      })
    )
  })

const feedFlagDescription =
  "Known feed id/name. Use --url with vehicle-positions, trip-updates, or alerts for manual URLs."

const optionalFeedFlag = Flag.optional(
  Flag.string("feed").pipe(Flag.withDescription("Known feed id/name."))
)

const optionalUrlFlag = Flag.optional(
  Flag.string("url").pipe(Flag.withDescription("Manual provider URL override."))
)

const mtaOpenDataDatasetListCommand = Command.make("list", {}, handleMtaOpenDataList).pipe(
  Command.withShortDescription("List curated MTA Open Data descriptors.")
)

const mtaOpenDataDatasetInfoCommand = Command.make(
  "info",
  {
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("MTA Open Data Socrata dataset id.")
    )
  },
  handleMtaOpenDataInfo
).pipe(Command.withShortDescription("Show MTA Open Data dataset metadata."))

const mtaOpenDataDatasetQueryCommand = Command.make(
  "query",
  {
    datasetId: Flag.string("dataset").pipe(
      Flag.withDescription("MTA Open Data Socrata dataset id.")
    ),
    select: Flag.string("select").pipe(
      Flag.withDescription("SoQL select expression or full SELECT query.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleMtaOpenDataQuery
).pipe(Command.withShortDescription("Run an MTA Open Data SODA3 query."))

const mtaOpenDataDatasetCommand = Command.make("dataset").pipe(
  Command.withShortDescription("MTA Open Data dataset commands."),
  Command.withSubcommands([
    mtaOpenDataDatasetListCommand,
    mtaOpenDataDatasetInfoCommand,
    mtaOpenDataDatasetQueryCommand
  ])
)

const mtaOpenDataCommand = Command.make("open-data").pipe(
  Command.withShortDescription("MTA Open Data commands."),
  Command.withSubcommands([mtaOpenDataDatasetCommand])
)

const mtaGtfsStaticListCommand = Command.make("list", {}, handleMtaGtfsStaticList).pipe(
  Command.withShortDescription("List known MTA GTFS static feed descriptors.")
)

const mtaGtfsStaticProbeCommand = Command.make(
  "probe",
  {
    feed: optionalFeedFlag,
    url: optionalUrlFlag,
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleMtaGtfsStaticProbe
).pipe(Command.withShortDescription("Probe an MTA GTFS static feed."))

const mtaGtfsStaticFetchCommand = Command.make(
  "fetch",
  {
    feed: optionalFeedFlag,
    url: optionalUrlFlag,
    output: Flag.string("output").pipe(
      Flag.withDescription("Destination file path for the downloaded response body.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleMtaGtfsStaticFetch
).pipe(Command.withShortDescription("Fetch an MTA GTFS static file."))

const mtaGtfsStaticCommand = Command.make("gtfs-static").pipe(
  Command.withShortDescription("MTA GTFS static commands."),
  Command.withSubcommands([
    mtaGtfsStaticListCommand,
    mtaGtfsStaticProbeCommand,
    mtaGtfsStaticFetchCommand
  ])
)

const mtaGtfsRealtimeListCommand = Command.make("list", {}, handleMtaGtfsRealtimeList).pipe(
  Command.withShortDescription("List known MTA GTFS realtime feed descriptors.")
)

const mtaGtfsRealtimeProbeCommand = Command.make(
  "probe",
  {
    feed: Flag.string("feed").pipe(Flag.withDescription(feedFlagDescription)),
    url: optionalUrlFlag,
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleMtaGtfsRealtimeProbe
).pipe(Command.withShortDescription("Probe an MTA GTFS realtime feed."))

const mtaGtfsRealtimeDecodeCommand = Command.make(
  "decode",
  {
    feed: Flag.string("feed").pipe(Flag.withDescription(feedFlagDescription)),
    url: optionalUrlFlag,
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleMtaGtfsRealtimeDecode
).pipe(Command.withShortDescription("Fetch and decode an MTA GTFS realtime feed."))

const mtaGtfsRealtimeCaptureCommand = Command.make(
  "capture",
  {
    feed: Flag.string("feed").pipe(Flag.withDescription(feedFlagDescription)),
    url: optionalUrlFlag,
    output: Flag.string("output").pipe(
      Flag.withDescription("Destination file path for the raw GTFS realtime protobuf bytes.")
    ),
    manifestOutput: Flag.string("manifest-output").pipe(
      Flag.withDescription("Destination file path for the capture manifest JSON.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleMtaGtfsRealtimeCapture
).pipe(Command.withShortDescription("Capture raw MTA GTFS realtime bytes and a manifest."))

const mtaGtfsRealtimeCommand = Command.make("gtfs-rt").pipe(
  Command.withShortDescription("MTA GTFS realtime commands."),
  Command.withSubcommands([
    mtaGtfsRealtimeListCommand,
    mtaGtfsRealtimeProbeCommand,
    mtaGtfsRealtimeDecodeCommand,
    mtaGtfsRealtimeCaptureCommand
  ])
)

export const mtaCommand = Command.make("mta").pipe(
  Command.withShortDescription("MTA data commands."),
  Command.withSubcommands([mtaOpenDataCommand, mtaGtfsStaticCommand, mtaGtfsRealtimeCommand])
)
