/**
 * The `ntk` command tree and one run of it.
 */
import * as Console from "effect/Console"
import * as CliError from "effect/cli/CliError"
import * as CliOutput from "effect/cli/CliOutput"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as GlobalFlag from "effect/cli/GlobalFlag"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as BuildInfo from "./BuildInfo"
import { mtaCommand } from "./commands/Mta"
import { nycDotCommand, nycOpenDataCommand } from "./commands/NycOpenData"
import { catalogCommand, socrataCommand } from "./commands/Socrata"
import { type ApiFamily, schemaVersion } from "./Envelope"
import * as Files from "./Files"
import * as Http from "./Http"
import * as Output from "./Output"

// `run` reads these from argv because they also decide how parse errors are
// reported. Declaring them here documents them in --help and lets any command accept them.
const jsonFlag = GlobalFlag.Setting("json")({
  flag: Flag.Boolean("json").pipe(
    Flag.withDescription("Write exactly one JSON envelope to stdout instead of readable output."),
    Flag.withDefault(false)
  )
})

const dryRunFlag = GlobalFlag.Setting("dry-run")({
  flag: Flag.Boolean("dry-run").pipe(
    Flag.withDescription("Print the HTTP requests a command would send, and send none."),
    Flag.withDefault(false)
  )
})

export const command = Command.make("ntk").pipe(
  Command.withDescription(
    "Official NYC and MTA transit data: Socrata SODA3, MTA GTFS feeds and NYC DOT datasets."
  ),
  Command.withGlobalFlags([jsonFlag, dryRunFlag]),
  Command.withSubcommands([
    socrataCommand,
    catalogCommand,
    mtaCommand,
    nycOpenDataCommand,
    nycDotCommand
  ])
)

const families = {
  socrata: "socrata",
  catalog: "socrata",
  mta: "mta",
  "nyc-open-data": "nyc-open-data",
  "nyc-dot": "nyc-dot"
} satisfies Record<string, ApiFamily>

const familyOf = (args: ReadonlyArray<string>): ApiFamily => {
  const name = args.find((arg): arg is keyof typeof families => Object.hasOwn(families, arg))
  return name === undefined ? "cli" : families[name]
}

// effect/cli prints help through Console. In JSON mode it is kept out of stdout:
// `--help` answers with it inside the envelope, and anything else printed is dropped.
const collectingConsole = (printed: Array<string>): Console.Console => ({
  ...console,
  log: (...parts: ReadonlyArray<unknown>) => {
    printed.push(parts.join(" "))
  },
  error: () => {}
})

/**
 * One CLI run against the `HttpClient` and platform services in context.
 * `--json`, `--dry-run` and `--version` are read from argv first because they
 * decide how everything after them is reported, parse errors included.
 */
export const run = Effect.fn("Cli.run")(function* (args: ReadonlyArray<string>) {
  const json = args.includes("--json")
  const dryRun = args.includes("--dry-run")
  const help = args.includes("--help") || args.includes("-h")
  const apiFamily = familyOf(args)
  const output = json ? Output.layerJson : Output.layerHuman

  if (args.includes("--version") || args.includes("-v")) {
    return yield* Output.success(
      "cli",
      json
        ? {
            binary: "ntk",
            version: BuildInfo.version,
            schemaVersion,
            commit: BuildInfo.commit,
            buildTarget: BuildInfo.buildTarget
          }
        : `ntk ${BuildInfo.version}`
    ).pipe(Effect.provide(output))
  }

  const recorded = yield* Ref.make<ReadonlyArray<Http.RecordedRequest>>([])
  const io = dryRun
    ? Layer.mergeAll(
        Http.dryRun.pipe(Layer.provide(Layer.succeed(Http.DryRun, recorded))),
        Files.dryRun
      )
    : Http.live
  const parse = Command.runWith(command, { version: BuildInfo.version, renderErrors: !json })(args)
  const printed: Array<string> = []
  const parsed = json
    ? parse.pipe(
        Effect.provideService(Console.Console, collectingConsole(printed)),
        Effect.provide(CliOutput.layer(CliOutput.defaultFormatter({ colors: false }))),
        Effect.andThen(
          help
            ? Effect.suspend(() => Output.success(apiFamily, { help: printed.join("\n") }))
            : Effect.void
        )
      )
    : parse

  return yield* parsed.pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        const requests = yield* Ref.get(recorded)
        if (requests.length > 0) {
          return yield* Output.success(apiFamily, { dryRun: true, requests })
        }
        if (!json && CliError.isCliError(error) && error._tag === "ShowHelp") {
          // effect/cli has already printed the help and the parse errors.
          return yield* error
        }
        yield* Output.failure(apiFamily, Output.errorDetail(error))
        return yield* new Output.Reported()
      })
    ),
    Effect.provide(Layer.mergeAll(output, io))
  )
})
