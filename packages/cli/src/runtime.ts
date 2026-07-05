import { MtaHttpLive, mtaConfigLayer } from "@nyc-transit-kit/mta/client"
import { GtfsRealtimeDecoder } from "@nyc-transit-kit/mta/gtfs-realtime"
import { Soda3ClientConfig, Soda3HttpLive } from "@nyc-transit-kit/soda3/client"
import * as Layer from "effect/Layer"
import type { CliRuntime } from "./commands/shared"

interface Soda3CliLayerConfig {
  readonly appToken?: string
}

const soda3CliLayer = (config: Soda3CliLayerConfig) =>
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

const mtaCliLayer = Layer.mergeAll(MtaHttpLive, mtaCliConfigLayer)

const mtaRealtimeCliLayer = Layer.mergeAll(MtaHttpLive, mtaCliConfigLayer, GtfsRealtimeDecoder.Live)

export const makeCliRuntime = (env: Readonly<Record<string, string | undefined>>): CliRuntime => {
  const soda3Layer = soda3CliLayer({
    appToken: env.SOCRATA_APP_TOKEN
  })

  return {
    soda3Layer,
    mtaLayer: mtaCliLayer,
    mtaRealtimeLayer: mtaRealtimeCliLayer
  }
}
