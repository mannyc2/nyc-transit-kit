import { makeDescriptorRegistry } from "@nyc-transit-kit/contracts/descriptors"
import { MtaOpenDataCatalogRow, MtaOpenDataDatasetDescriptor } from "@nyc-transit-kit/contracts/mta"
import { queryRows } from "@nyc-transit-kit/soda3/client"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { decodeMtaInput } from "./internal/decode"
import { mtaOpenDataDescriptorRecords } from "./internal/open-data-descriptor-records"
export const mtaOpenDataDomain = "data.ny.gov"
const decodeDescriptor = Schema.decodeUnknownSync(MtaOpenDataDatasetDescriptor)
const descriptorRegistry = makeDescriptorRegistry({
  descriptors: mtaOpenDataDescriptorRecords.map((record) => decodeDescriptor(record)),
  id: (dataset) => String(dataset.id)
})
const requireMtaOpenDataDescriptor = (datasetId: string) => {
  const descriptor = descriptorRegistry.findById(datasetId)
  if (descriptor === undefined) {
    throw new Error(`Missing MTA Open Data descriptor: ${datasetId}`)
  }
  return descriptor
}
export const mtaOpenDataCatalogDescriptor = requireMtaOpenDataDescriptor("f462-ka72")
export const mtaOpenDataDatasets: ReadonlyArray<MtaOpenDataDatasetDescriptor> =
  descriptorRegistry.all
export const findMtaOpenDataDataset = (datasetId: string) => descriptorRegistry.findById(datasetId)
export const queryMtaOpenData = (input: {
  readonly datasetId: string
  readonly query: string
  readonly page?: {
    readonly pageNumber: number
    readonly pageSize: number
  }
}) =>
  queryRows({
    domain: mtaOpenDataDomain,
    datasetId: input.datasetId,
    query: input.query,
    ...(input.page === undefined ? {} : { page: input.page })
  })
export const decodeMtaOpenDataCatalogRow = decodeMtaInput(
  "mta-open-data-catalog",
  MtaOpenDataCatalogRow
)
export const decodeMtaOpenDataCatalogRows = (inputs: ReadonlyArray<unknown>) =>
  Effect.all(inputs.map((input) => decodeMtaOpenDataCatalogRow(input)))
