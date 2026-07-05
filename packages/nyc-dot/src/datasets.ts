import {
  makeDescriptorRegistry,
  NycDotDatasetDescriptor
} from "@nyc-transit-kit/contracts/descriptors"
import { exportResponse } from "@nyc-transit-kit/soda3/export"
import { queryRows } from "@nyc-transit-kit/soda3/query"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { nycDotDescriptorRecords } from "./internal/descriptor-records"

export class UnsupportedDatasetError extends Schema.TaggedErrorClass<UnsupportedDatasetError>()(
  "UnsupportedDatasetError",
  {
    dataset: Schema.String,
    message: Schema.String
  }
) {}

export const isUnsupportedDatasetError = (value: unknown): value is UnsupportedDatasetError =>
  value instanceof UnsupportedDatasetError

export const nycDotOpenDataDomain = "data.cityofnewyork.us"

const decodeDescriptor = Schema.decodeUnknownSync(NycDotDatasetDescriptor)
const descriptorRegistry = makeDescriptorRegistry({
  descriptors: nycDotDescriptorRecords.map((record) => decodeDescriptor(record)),
  id: (dataset) => String(dataset.id),
  lookupKeys: (dataset) => [String(dataset.name)]
})

const requireKnownNycDotDescriptor = (name: string) => {
  const descriptor = descriptorRegistry.find(name)
  if (descriptor === undefined) {
    throw new Error(`Missing NYC DOT descriptor: ${name}`)
  }
  return descriptor
}

export const busLanesLocalStreets = requireKnownNycDotDescriptor("bus-lanes-local-streets")

export const trafficSpeeds = requireKnownNycDotDescriptor("traffic-speeds")

export const trafficVolumeCounts = requireKnownNycDotDescriptor("traffic-volume-counts")

export const nycDotDatasets: ReadonlyArray<NycDotDatasetDescriptor> = descriptorRegistry.all

export const initialDatasetIds = descriptorRegistry.ids

export const findNycDotDataset = (name: string) => descriptorRegistry.find(name)

export const requireNycDotDataset = (name: string) => {
  const dataset = findNycDotDataset(name)
  if (dataset !== undefined) {
    return Effect.succeed(dataset)
  }

  return Effect.fail(
    UnsupportedDatasetError.make({
      dataset: name,
      message: `Unsupported NYC DOT dataset: ${name}`
    })
  )
}

export const queryNycDotDataset = (input: {
  readonly name: string
  readonly query: string
  readonly page?: {
    readonly pageNumber: number
    readonly pageSize: number
  }
}) =>
  Effect.gen(function* () {
    const dataset = yield* requireNycDotDataset(input.name)
    return yield* queryRows({
      domain: nycDotOpenDataDomain,
      datasetId: String(dataset.id),
      query: input.query,
      ...(input.page === undefined ? {} : { page: input.page })
    })
  })

export const exportNycDotDataset = (input: {
  readonly name: string
  readonly format: "csv" | "json" | "geojson"
  readonly query?: string
  readonly range?: {
    readonly start: number
    readonly end: number
  }
}) =>
  Effect.gen(function* () {
    const dataset = yield* requireNycDotDataset(input.name)
    return yield* exportResponse({
      domain: nycDotOpenDataDomain,
      datasetId: String(dataset.id),
      format: input.format,
      ...(input.query === undefined ? {} : { query: input.query }),
      ...(input.range === undefined ? {} : { range: input.range })
    })
  })
