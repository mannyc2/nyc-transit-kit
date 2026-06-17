import type { GtfsRealtimeDecoder } from "@nyc-transit-kit/mta/gtfs-realtime"
import type { Soda3ClientConfig } from "@nyc-transit-kit/soda3/client"
import * as Context from "effect/Context"
import type * as Layer from "effect/Layer"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type { CliMetaApiFamily } from "../output"

export type ApiFamily = CliMetaApiFamily

export type CommandResult<A> =
  | {
      readonly _tag: "Failure"
      readonly error: unknown
    }
  | {
      readonly _tag: "Success"
      readonly data: A
    }

export type CliRuntime = {
  readonly soda3Layer: Layer.Layer<Soda3ClientConfig | HttpClient.HttpClient>
  readonly mtaLayer: Layer.Layer<HttpClient.HttpClient>
  readonly mtaRealtimeLayer: Layer.Layer<HttpClient.HttpClient | GtfsRealtimeDecoder>
}

export type CommandContext = {
  readonly runtime: CliRuntime
  readonly writeJson: (output: unknown) => void
}

export class CliCommandContext extends Context.Service<CliCommandContext, CommandContext>()(
  "@nyc-transit-kit/cli/CliCommandContext"
) {}
