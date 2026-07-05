import { mtaConfigLayer, mtaFetchLayer } from "@nyc-transit-kit/mta/client"
import type { GtfsRealtimeDecoderImplementation } from "@nyc-transit-kit/mta/gtfs-realtime"
import { GtfsRealtimeDecoder } from "@nyc-transit-kit/mta/gtfs-realtime"
import { type Soda3LayerOptions, soda3Layer } from "@nyc-transit-kit/soda3/client"
import * as Layer from "effect/Layer"
import type { MtaCompatOptions } from "../mta"
import type { Soda3CompatOptions } from "../soda3"

const soda3CompatLayerOptions = (options: Soda3CompatOptions): Soda3LayerOptions => ({
  retryTimes: options.retryTimes ?? 0,
  ...(options.appToken === undefined ? {} : { appToken: options.appToken }),
  ...(options.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs }),
  ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  ...(options.fetch === undefined ? {} : { fetch: options.fetch })
})

export const soda3CompatLayer = (options: Soda3CompatOptions = {}) =>
  soda3Layer(soda3CompatLayerOptions(options))

export const mtaCompatLayer = (options: MtaCompatOptions = {}) =>
  Layer.mergeAll(
    mtaConfigLayer(options),
    mtaFetchLayer(options.fetch),
    options.decoder === undefined
      ? GtfsRealtimeDecoder.Live
      : Layer.succeed(GtfsRealtimeDecoder)({
          decode: options.decoder
        })
  )

export type { GtfsRealtimeDecoderImplementation }
