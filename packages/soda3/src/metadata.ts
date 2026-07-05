import {
  type Soda3CatalogResultFragment,
  Soda3DatasetMetadataRequest,
  type Soda3DatasetMetadataRequestInput
} from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import { catalogSearch } from "./catalog"
import { ProviderContractError } from "./errors"
import { decodeInput } from "./internal/decode"

export type { Soda3DatasetMetadataRequestInput }

const decodeDatasetMetadataRequest = decodeInput("metadata", Soda3DatasetMetadataRequest)

const matchingResult = (results: ReadonlyArray<Soda3CatalogResultFragment>, datasetId: string) =>
  results.find((result) => String(result.resource.id) === datasetId)

export const fetchDatasetMetadata = Effect.fn("Soda3.fetchDatasetMetadata")(function* (
  input: Soda3DatasetMetadataRequestInput
) {
  const request = yield* decodeDatasetMetadataRequest(input)
  const response = yield* catalogSearch({
    domain: request.domain,
    ids: [request.datasetId],
    limit: 1
  })
  const result = matchingResult(response.results, String(request.datasetId))

  if (result === undefined) {
    return yield* ProviderContractError.make({
      operation: "metadata",
      message: `Discovery metadata response did not include dataset ${request.datasetId}`
    })
  }

  return result
})
