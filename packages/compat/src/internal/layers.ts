import type { GtfsRealtimeDecoderImplementation } from "@nyc-transit-kit/mta/gtfs-realtime"
import { GtfsRealtimeDecoder } from "@nyc-transit-kit/mta/gtfs-realtime"
import { MtaHttpLive } from "@nyc-transit-kit/mta/gtfs-static"
import { Soda3ClientConfig, Soda3HttpLive } from "@nyc-transit-kit/soda3/client"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import type { MtaCompatOptions } from "../mta"
import type { Soda3CompatOptions } from "../soda3"

export const soda3CompatLayer = (options: Soda3CompatOptions = {}) =>
  Layer.mergeAll(
    Layer.succeed(Soda3ClientConfig)({
      appToken: options.appToken,
      retryTimes: options.retryTimes ?? 0
    }),
    options.fetch === undefined
      ? Soda3HttpLive
      : FetchHttpClient.layer.pipe(
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, options.fetch))
        )
  )

export const mtaCompatLayer = (options: MtaCompatOptions = {}) =>
  Layer.mergeAll(
    options.fetch === undefined
      ? MtaHttpLive
      : FetchHttpClient.layer.pipe(
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, options.fetch))
        ),
    options.decoder === undefined
      ? GtfsRealtimeDecoder.Live
      : Layer.succeed(GtfsRealtimeDecoder)({
          decode: options.decoder
        })
  )

export type { GtfsRealtimeDecoderImplementation }
