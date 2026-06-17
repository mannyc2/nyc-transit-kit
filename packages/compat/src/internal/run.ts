import type { GtfsRealtimeDecoder } from "@nyc-transit-kit/mta/gtfs-realtime"
import type { Soda3ClientConfig } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type { MtaCompatOptions } from "../mta"
import type { Soda3CompatOptions } from "../soda3"
import { mtaCompatLayer, soda3CompatLayer } from "./layers"

export const runSoda3Effect = <A, E>(
  effect: Effect.Effect<A, E, Soda3ClientConfig | HttpClient.HttpClient>,
  options?: Soda3CompatOptions
) => Effect.runPromise(effect.pipe(Effect.provide(soda3CompatLayer(options))))

export const runMtaEffect = <A, E>(
  effect: Effect.Effect<A, E, HttpClient.HttpClient | GtfsRealtimeDecoder>,
  options?: MtaCompatOptions
) => Effect.runPromise(effect.pipe(Effect.provide(mtaCompatLayer(options))))
