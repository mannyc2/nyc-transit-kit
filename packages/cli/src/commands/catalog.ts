import { buildCatalogSearchUrl, catalogSearch } from "@nyc-transit-kit/soda3/catalog"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import { runEffect, writeSuccess } from "./shared"
import { CliCommandContext } from "./types"

export const catalogCommandPaths: ReadonlyArray<ReadonlyArray<string>> = [["catalog", "search"]]

export const handleCatalogSearch = (config: {
  readonly domain: string
  readonly query: string
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const context = yield* CliCommandContext
    const tokens = ["catalog", "search"]
    const request = {
      domain: config.domain,
      query: config.query
    }
    const url = yield* buildCatalogSearchUrl(request)

    if (config.dryRun) {
      return yield* writeSuccess(context, "socrata", {
        dryRun: true,
        method: "GET",
        url: url.toString()
      })
    }

    return yield* runEffect(
      context,
      "socrata",
      tokens,
      catalogSearch(request).pipe(Effect.provide(context.runtime.soda3Layer))
    )
  })

const catalogSearchCommand = Command.make(
  "search",
  {
    domain: Flag.string("domain").pipe(
      Flag.withDescription("Socrata domain without protocol, such as data.cityofnewyork.us.")
    ),
    query: Flag.string("query").pipe(
      Flag.withDescription("Search text for Socrata Discovery API.")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Print the planned request without contacting the provider.")
    )
  },
  handleCatalogSearch
).pipe(Command.withShortDescription("Search a Socrata catalog."))

export const catalogCommand = Command.make("catalog").pipe(
  Command.withShortDescription("Socrata catalog commands."),
  Command.withSubcommands([catalogSearchCommand])
)
