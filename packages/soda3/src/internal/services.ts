import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import { Soda3HttpLive } from "./http"

export interface Soda3ClientConfigShape {
  readonly appToken?: string
  readonly retryTimes?: number
  readonly timeoutMs?: number
}

export class Soda3ClientConfig extends Context.Service<Soda3ClientConfig, Soda3ClientConfigShape>()(
  "@nyc-transit-kit/soda3/Soda3ClientConfig"
) {
  static readonly Default = Layer.succeed(Soda3ClientConfig)({
    retryTimes: 0
  })
}

export const Soda3Live = Layer.mergeAll(Soda3ClientConfig.Default, Soda3HttpLive)
