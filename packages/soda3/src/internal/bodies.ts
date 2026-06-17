import type { Soda3ExportRequest, Soda3QueryRequest } from "@nyc-transit-kit/contracts/soda3"

export const toQueryBody = (request: Soda3QueryRequest) => ({
  query: request.query,
  page: request.page,
  parameters: request.parameters,
  timeout: request.timeout,
  includeSystem: request.includeSystem,
  includeSynthetic: request.includeSynthetic,
  orderingSpecifier: request.orderingSpecifier
})

export const toExportBody = (request: Soda3ExportRequest) => ({
  query: request.query,
  parameters: request.parameters,
  timeout: request.timeout,
  serializationOptions: request.serializationOptions
})

export const rangeHeader = (request: Soda3ExportRequest) =>
  request.range === undefined ? undefined : `bytes=${request.range.start}-${request.range.end}`
