import type {
  GtfsRealtimeDecoderImplementation,
  MtaGtfsRealtimeProbeRequestInput
} from "@nyc-transit-kit/mta/gtfs-realtime"
import { probeGtfsRealtime } from "@nyc-transit-kit/mta/gtfs-realtime"
import type { MtaGtfsStaticFetchRequestInput } from "@nyc-transit-kit/mta/gtfs-static"
import { fetchGtfsStatic } from "@nyc-transit-kit/mta/gtfs-static"
import { runMtaEffect } from "./internal/run"

export type { MtaError } from "./errors"
export {
  isMtaError,
  MtaDecodeError,
  MtaHttpError,
  MtaInvalidInputError
} from "./errors"

export interface MtaCompatOptions {
  readonly fetch?: typeof fetch
  readonly decoder?: GtfsRealtimeDecoderImplementation
}

export const fetchMtaGtfsStaticBytes = (
  input: MtaGtfsStaticFetchRequestInput,
  options?: MtaCompatOptions
) => runMtaEffect(fetchGtfsStatic(input), options)

export const probeMtaGtfsRealtime = (
  input: MtaGtfsRealtimeProbeRequestInput,
  options?: MtaCompatOptions
) => runMtaEffect(probeGtfsRealtime(input), options)
