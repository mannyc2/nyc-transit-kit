import { GtfsRealtimeDecoder } from "@nyc-transit-kit/mta/gtfs-realtime"
import { MtaHttpLive } from "@nyc-transit-kit/mta/gtfs-static"
import { Soda3ClientConfig, Soda3HttpLive } from "@nyc-transit-kit/soda3/client"
import * as Layer from "effect/Layer"

export interface Soda3CliLayerConfig {
  readonly appToken?: string
}

export const soda3CliLayer = (config: Soda3CliLayerConfig) =>
  Layer.mergeAll(
    Layer.succeed(Soda3ClientConfig)({
      appToken: config.appToken,
      retryTimes: 2
    }),
    Soda3HttpLive
  )

export const mtaCliLayer = MtaHttpLive

export const mtaRealtimeCliLayer = Layer.mergeAll(MtaHttpLive, GtfsRealtimeDecoder.Live)
