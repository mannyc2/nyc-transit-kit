import { type FetchImplementation, fetchHttpClientLayer } from "@nyc-transit-kit/soda3/transport"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
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
export const MtaHttpLive = fetchHttpClientLayer()
export const mtaConfigLayer = (options: MtaClientConfigShape = {}) =>
  Layer.succeed(MtaClientConfig)({
    retryTimes: options.retryTimes ?? 0,
    ...(options.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs })
  })
export const mtaFetchLayer = fetchHttpClientLayer
export const mtaLayer = (options: MtaLayerOptions = {}) =>
  Layer.mergeAll(mtaConfigLayer(options), mtaFetchLayer(options.fetch))
export const MtaLive = mtaLayer()
