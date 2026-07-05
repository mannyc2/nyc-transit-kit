import type { FetchImplementation } from "@nyc-transit-kit/soda3/client"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"

export interface MtaClientConfigShape {
  readonly retryTimes?: number
  readonly retryDelayMs?: number
  readonly timeoutMs?: number
}

export interface MtaLayerOptions extends MtaClientConfigShape {
  readonly fetch?: FetchImplementation
}

export const defaultMtaClientConfig: MtaClientConfigShape = {
  retryTimes: 0
}

export class MtaClientConfig extends Context.Service<MtaClientConfig, MtaClientConfigShape>()(
  "@nyc-transit-kit/mta/MtaClientConfig"
) {
  static readonly Default = Layer.succeed(MtaClientConfig)(defaultMtaClientConfig)
}

export const MtaHttpLive = FetchHttpClient.layer

export const mtaConfigLayer = (options: MtaClientConfigShape = {}) =>
  Layer.succeed(MtaClientConfig)({
    retryTimes: options.retryTimes ?? 0,
    ...(options.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs })
  })

export const mtaFetchLayer = (fetchImplementation?: FetchImplementation) =>
  fetchImplementation === undefined
    ? MtaHttpLive
    : FetchHttpClient.layer.pipe(
        Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetchImplementation as typeof fetch))
      )

export const mtaLayer = (options: MtaLayerOptions = {}) =>
  Layer.mergeAll(mtaConfigLayer(options), mtaFetchLayer(options.fetch))

export const MtaLive = mtaLayer()
