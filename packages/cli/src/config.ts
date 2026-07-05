import { MtaHttpLive, mtaConfigLayer } from "@nyc-transit-kit/mta/client"
import { GtfsRealtimeDecoder } from "@nyc-transit-kit/mta/gtfs-realtime"
import { Soda3ClientConfig, Soda3HttpLive } from "@nyc-transit-kit/soda3/client"
import * as Layer from "effect/Layer"

export interface Soda3CliLayerConfig {
  readonly appToken?: string
}

export const soda3CliLayer = (config: Soda3CliLayerConfig) =>
  Layer.mergeAll(
    Layer.succeed(Soda3ClientConfig)({
      appToken: config.appToken,
      retryTimes: 2,
      retryDelayMs: 250
    }),
    Soda3HttpLive
  )

const mtaCliConfigLayer = mtaConfigLayer({
  retryTimes: 2,
  retryDelayMs: 250
})

export const mtaCliLayer = Layer.mergeAll(MtaHttpLive, mtaCliConfigLayer)

export const mtaRealtimeCliLayer = Layer.mergeAll(
  MtaHttpLive,
  mtaCliConfigLayer,
  GtfsRealtimeDecoder.Live
)
