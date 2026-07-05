import { mtaConfigLayer, mtaFetchLayer } from "@nyc-transit-kit/mta/client"
import type {
  GtfsRealtimeDecoder,
  GtfsRealtimeDecoderImplementation
} from "@nyc-transit-kit/mta/gtfs-realtime"
import { GtfsRealtimeDecoder as GtfsRealtimeDecoderTag } from "@nyc-transit-kit/mta/gtfs-realtime"
import type { Soda3ClientConfig, Soda3LayerOptions } from "@nyc-transit-kit/soda3/client"
import { soda3Layer } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as HttpClient from "effect/unstable/http/HttpClient"
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
      ? GtfsRealtimeDecoderTag.Live
      : Layer.succeed(GtfsRealtimeDecoderTag)({
          decode: options.decoder
        })
  )
export const runSoda3Effect = <A, E>(
  effect: Effect.Effect<A, E, Soda3ClientConfig | HttpClient.HttpClient>,
  options?: Soda3CompatOptions
) => Effect.runPromise(effect.pipe(Effect.provide(soda3CompatLayer(options))))
export const runMtaEffect = <A, E>(
  effect: Effect.Effect<A, E, HttpClient.HttpClient | GtfsRealtimeDecoder>,
  options?: MtaCompatOptions
) => Effect.runPromise(effect.pipe(Effect.provide(mtaCompatLayer(options))))
export type { GtfsRealtimeDecoderImplementation }
