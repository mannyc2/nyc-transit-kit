import * as ElevatorEscalator from "@nyc-transit-kit/mta/ElevatorEscalator"
import * as GtfsRealtime from "@nyc-transit-kit/mta/GtfsRealtime"
import * as GtfsStatic from "@nyc-transit-kit/mta/GtfsStatic"
import * as MtaOpenData from "@nyc-transit-kit/mta/MtaOpenData"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Record from "effect/Record"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { textFile, writeFiles } from "../Files"
import * as Output from "../Output"
import { datasetCommands, datasetIdFlag, outputFlag } from "./Shared"

const feedFlag = <Name extends string>(feeds: Readonly<Record<Name, unknown>>) =>
  Flag.Literals("feed", Record.keys(feeds)).pipe(Flag.withDescription("Feed name; see `list`."))

const urlFlag = Flag.String("url").pipe(
  Flag.withDescription("Fetch this URL instead of the feed's usual one, e.g. a mirror."),
  Flag.optional
)

/** The feed's name and the URL to fetch: `--url` when given, the feed's own URL otherwise. */
const target = <Name extends string>(
  feeds: Readonly<Record<Name, { readonly url: string }>>,
  config: { readonly feed: Name; readonly url: Option.Option<string> }
) => ({
  feed: config.feed,
  url: Option.getOrElse(config.url, () => feeds[config.feed].url)
})

const listCommand = (feeds: Readonly<Record<string, object>>, description: string) =>
  Command.make("list", {}, () =>
    Output.success("mta", { feeds: Record.collect(feeds, (name, feed) => ({ name, ...feed })) })
  ).pipe(Command.withShortDescription(description))

const staticFeed = { feed: feedFlag(GtfsStatic.feeds), url: urlFlag }

const gtfsStaticCommand = Command.make("gtfs-static").pipe(
  Command.withShortDescription("MTA GTFS static schedules."),
  Command.withSubcommands([
    listCommand(GtfsStatic.feeds, "List GTFS static feeds."),
    Command.make("probe", staticFeed, (config) => {
      const { feed, url } = target(GtfsStatic.feeds, config)
      return GtfsStatic.probe(url).pipe(
        Effect.flatMap((probe) => Output.success("mta", { feed, ...probe }))
      )
    }).pipe(Command.withShortDescription("HEAD a GTFS static zip: size, type and freshness.")),
    Command.make(
      "fetch",
      { ...staticFeed, output: outputFlag("File to write the zip to.") },
      (config) => {
        const { feed, url } = target(GtfsStatic.feeds, config)
        return writeFiles([{ path: config.output, content: GtfsStatic.stream(url) }]).pipe(
          Effect.flatMap(([file]) => Output.success("mta", { feed, url, ...file }))
        )
      }
    ).pipe(Command.withShortDescription("Download a GTFS static zip."))
  ])
)

const realtimeFeed = { feed: feedFlag(GtfsRealtime.feeds), url: urlFlag }
const encodeManifest = Schema.encodeEffect(GtfsRealtime.CaptureManifest)

const gtfsRealtimeCommand = Command.make("gtfs-rt").pipe(
  Command.withShortDescription("MTA GTFS-realtime feeds."),
  Command.withSubcommands([
    listCommand(GtfsRealtime.feeds, "List GTFS-realtime feeds."),
    Command.make("probe", realtimeFeed, (config) =>
      Effect.gen(function* () {
        const { feed, url } = target(GtfsRealtime.feeds, config)
        const bytes = yield* GtfsRealtime.fetchBytes(url)
        const message = yield* GtfsRealtime.decode(bytes)
        yield* Output.success("mta", {
          feed,
          url,
          bytes: bytes.byteLength,
          ...GtfsRealtime.summarize(message)
        })
      })
    ).pipe(Command.withShortDescription("Fetch a feed and count what is in it.")),
    Command.make("decode", realtimeFeed, (config) =>
      Effect.gen(function* () {
        const { feed, url } = target(GtfsRealtime.feeds, config)
        const message = yield* GtfsRealtime.fetchMessage(url)
        yield* Output.success("mta", { feed, url, message: GtfsRealtime.toJson(message) })
      })
    ).pipe(Command.withShortDescription("Fetch a feed and print every entity as JSON.")),
    Command.make(
      "capture",
      {
        ...realtimeFeed,
        output: outputFlag("File to write the raw protobuf bytes to."),
        manifestOutput: Flag.String("manifest-output").pipe(
          Flag.withDescription("File to write the capture manifest JSON to.")
        )
      },
      (config) =>
        Effect.gen(function* () {
          const { feed, url } = target(GtfsRealtime.feeds, config)
          const { bytes, manifest } = yield* GtfsRealtime.capture(feed, url)
          const encoded = yield* Effect.orDie(encodeManifest(manifest))
          yield* writeFiles([
            { path: config.output, content: Stream.make(bytes) },
            textFile(config.manifestOutput, `${JSON.stringify(encoded, null, 2)}\n`)
          ])
          yield* Output.success("mta", {
            output: config.output,
            manifestOutput: config.manifestOutput,
            manifest: encoded
          })
        })
    ).pipe(Command.withShortDescription("Save a feed's raw bytes with a manifest."))
  ])
)

const elevatorCommand = Command.make(
  "elevator-escalator",
  {
    feed: Flag.Literals("feed", Record.keys(ElevatorEscalator.feeds)).pipe(
      Flag.withDescription(
        "Current outages (upcoming included), upcoming only, or the equipment list."
      )
    )
  },
  ({ feed }) => {
    const selected: ElevatorEscalator.Feed = ElevatorEscalator.feeds[feed]
    return ElevatorEscalator.fetchRows(selected).pipe(
      Effect.flatMap((rows) => Output.success("mta", { feed, rows }))
    )
  }
).pipe(Command.withShortDescription("NYCT elevator and escalator outages and equipment."))

const openDataCommand = Command.make("open-data").pipe(
  Command.withShortDescription("MTA datasets on NYS Open Data (data.ny.gov)."),
  Command.withSubcommands([
    Command.make("dataset").pipe(
      Command.withShortDescription("MTA Open Data dataset commands."),
      Command.withSubcommands(
        datasetCommands({
          apiFamily: "mta",
          label: "MTA Open Data",
          datasets: MtaOpenData.datasets,
          select: datasetIdFlag.pipe(
            Flag.map((datasetId) => ({ domain: MtaOpenData.domain, datasetId }))
          )
        })
      )
    )
  ])
)

export const mtaCommand = Command.make("mta").pipe(
  Command.withShortDescription("MTA feeds and datasets."),
  Command.withSubcommands([
    openDataCommand,
    gtfsStaticCommand,
    gtfsRealtimeCommand,
    elevatorCommand
  ])
)
