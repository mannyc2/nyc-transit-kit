import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { localBinaryName } from "../index"
import { catalogCommand } from "./catalog"
import { mtaCommand } from "./mta"
import { nycDotCommand } from "./nyc-dot"
import { nycOpenDataCommand } from "./nyc-open-data"
import { failCommand } from "./shared"
import { socrataCommand } from "./socrata"
import { CliCommandContext } from "./types"

const handleMissingCommand = () =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    return yield* failCommand(
      context,
      "cli",
      "missing-command",
      `Run ${localBinaryName} --version --json for the current scaffold contract.`,
      []
    )
  })

export const rootCommand = Command.make("ntk", {}, handleMissingCommand).pipe(
  Command.withSharedFlags({
    json: Flag.boolean("json").pipe(
      Flag.withDescription("Write the stable JSON envelope instead of human output.")
    )
  }),
  Command.withSubcommands([
    socrataCommand,
    catalogCommand,
    mtaCommand,
    nycOpenDataCommand,
    nycDotCommand
  ])
)
