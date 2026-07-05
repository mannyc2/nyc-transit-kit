import type {
  GtfsRealtimeDecoderImplementation,
  MtaGtfsRealtimeCaptureRequestInput,
  MtaGtfsRealtimeProbeRequestInput
} from "@nyc-transit-kit/mta/gtfs-realtime"
import { captureGtfsRealtime, probeGtfsRealtime } from "@nyc-transit-kit/mta/gtfs-realtime"
import type { MtaGtfsStaticFetchRequestInput } from "@nyc-transit-kit/mta/gtfs-static"
import {
  fetchGtfsStatic,
  fetchGtfsStaticResponse as fetchGtfsStaticResponseEffect,
  probeGtfsStatic
} from "@nyc-transit-kit/mta/gtfs-static"
import { fetchMtaJsonDirect as fetchMtaJsonDirectEffect } from "@nyc-transit-kit/mta/json-direct"
import { queryMtaOpenData } from "@nyc-transit-kit/mta/open-data"
import type { FetchImplementation } from "@nyc-transit-kit/soda3/client"
import { runMtaEffect, runSoda3Effect } from "./internal/runtime"
import type { Soda3CompatOptions } from "./soda3"

type MtaJsonDirectInput = Parameters<typeof fetchMtaJsonDirectEffect>[0]
type MtaOpenDataQueryInput = Parameters<typeof queryMtaOpenData>[0]
export interface MtaCompatOptions {
  readonly fetch?: FetchImplementation
  readonly decoder?: GtfsRealtimeDecoderImplementation
  readonly retryTimes?: number
  readonly retryDelayMs?: number
  readonly timeoutMs?: number
}
export const probeMtaGtfsStatic = (
  input: MtaGtfsStaticFetchRequestInput,
  options?: MtaCompatOptions
) => runMtaEffect(probeGtfsStatic(input), options)
export const fetchMtaGtfsStaticResponse = (
  input: MtaGtfsStaticFetchRequestInput,
  options?: MtaCompatOptions
) => runMtaEffect(fetchGtfsStaticResponseEffect(input), options)
export const fetchMtaGtfsStaticBytes = (
  input: MtaGtfsStaticFetchRequestInput,
  options?: MtaCompatOptions
) => runMtaEffect(fetchGtfsStatic(input), options)
export const probeMtaGtfsRealtime = (
  input: MtaGtfsRealtimeProbeRequestInput,
  options?: MtaCompatOptions
) => runMtaEffect(probeGtfsRealtime(input), options)
export const captureMtaGtfsRealtime = (
  input: MtaGtfsRealtimeCaptureRequestInput,
  options?: MtaCompatOptions
) => runMtaEffect(captureGtfsRealtime(input), options)
export const fetchMtaJsonDirect = (input: MtaJsonDirectInput, options?: MtaCompatOptions) =>
  runMtaEffect(fetchMtaJsonDirectEffect(input), options)
export const queryMtaOpenDataRows = (input: MtaOpenDataQueryInput, options?: Soda3CompatOptions) =>
  runSoda3Effect(queryMtaOpenData(input), options)
