import { catalogSearch } from "@nyc-transit-kit/soda3/catalog"
import { defaultDomain } from "./descriptors"

export const searchNycOpenDataCatalog = (input: {
  readonly query?: string
  readonly limit?: number
  readonly offset?: number
}) => {
  const request: {
    readonly domain: string
    query?: string
    limit?: number
    offset?: number
  } = {
    domain: defaultDomain
  }

  if (input.query !== undefined) {
    request.query = input.query
  }
  if (input.limit !== undefined) {
    request.limit = input.limit
  }
  if (input.offset !== undefined) {
    request.offset = input.offset
  }

  return catalogSearch(request)
}
