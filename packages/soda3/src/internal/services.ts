import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import { Soda3HttpLive } from "./http"

export interface Soda3ClientConfigShape {
  readonly appToken?: string
  readonly retryTimes?: number
  readonly retryDelayMs?: number
  readonly timeoutMs?: number
}

export type FetchImplementation = (
  input: string | URL | globalThis.Request,
  init?: globalThis.RequestInit
) => Promise<globalThis.Response>

export interface Soda3LayerOptions extends Soda3ClientConfigShape {
  readonly fetch?: FetchImplementation
}

export class Soda3ClientConfig extends Context.Service<Soda3ClientConfig, Soda3ClientConfigShape>()(
  "@nyc-transit-kit/soda3/Soda3ClientConfig"
) {
  static readonly Default = Layer.succeed(Soda3ClientConfig)({
    retryTimes: 0
  })
}

export const soda3ConfigLayer = (options: Soda3ClientConfigShape = {}) =>
  Layer.succeed(Soda3ClientConfig)({
    retryTimes: options.retryTimes ?? 0,
    ...(options.appToken === undefined ? {} : { appToken: options.appToken }),
    ...(options.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs })
  })

export const soda3FetchLayer = (fetchImplementation?: FetchImplementation) =>
  fetchImplementation === undefined
    ? Soda3HttpLive
    : FetchHttpClient.layer.pipe(
        Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetchImplementation as typeof fetch))
      )

export const soda3Layer = (options: Soda3LayerOptions = {}) =>
  Layer.mergeAll(soda3ConfigLayer(options), soda3FetchLayer(options.fetch))

export const Soda3Live = soda3Layer()
