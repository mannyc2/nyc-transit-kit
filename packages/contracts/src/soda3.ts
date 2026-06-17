import * as Schema from "effect/Schema"
import { SocrataDatasetId, SocrataDomain } from "./ids"

type WidenedStringInput<T extends string> = T | (string & {})

export const Soda3Operation = Schema.Literals(["query", "export", "catalog"])
export type Soda3Operation = typeof Soda3Operation.Type

export const Soda3ExportFormat = Schema.Literals(["csv", "json", "geojson"])
export type Soda3ExportFormat = typeof Soda3ExportFormat.Type

export const Soda3OrderingSpecifier = Schema.Literals(["total", "discard"])
export type Soda3OrderingSpecifier = typeof Soda3OrderingSpecifier.Type

export const NonNegativeInteger = Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
export type NonNegativeInteger = typeof NonNegativeInteger.Type

export const PositiveInteger = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))
export type PositiveInteger = typeof PositiveInteger.Type

export const Soda3Row = Schema.Record(Schema.String, Schema.Unknown)
export type Soda3Row = typeof Soda3Row.Type

export class Soda3Page extends Schema.Class<Soda3Page>("Soda3Page")({
  pageNumber: PositiveInteger,
  pageSize: PositiveInteger
}) {}

export class Soda3QueryRequest extends Schema.Class<Soda3QueryRequest>("Soda3QueryRequest")({
  domain: SocrataDomain,
  datasetId: SocrataDatasetId,
  query: Schema.String,
  page: Schema.optionalKey(Soda3Page),
  parameters: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  timeout: Schema.optionalKey(PositiveInteger),
  includeSystem: Schema.optionalKey(Schema.Boolean),
  includeSynthetic: Schema.optionalKey(Schema.Boolean),
  orderingSpecifier: Schema.optionalKey(Soda3OrderingSpecifier)
}) {}
export type Soda3QueryRequestInput = Schema.Codec.Encoded<typeof Soda3QueryRequest>

export class Soda3QueryResponse extends Schema.Class<Soda3QueryResponse>("Soda3QueryResponse")({
  rows: Schema.Array(Soda3Row),
  rowCount: Schema.optionalKey(NonNegativeInteger)
}) {}

export class Soda3ByteRange extends Schema.Class<Soda3ByteRange>("Soda3ByteRange")({
  start: NonNegativeInteger,
  end: NonNegativeInteger
}) {}

export class Soda3ExportRequest extends Schema.Class<Soda3ExportRequest>("Soda3ExportRequest")({
  domain: SocrataDomain,
  datasetId: SocrataDatasetId,
  format: Soda3ExportFormat,
  query: Schema.optionalKey(Schema.String),
  parameters: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  timeout: Schema.optionalKey(PositiveInteger),
  serializationOptions: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  range: Schema.optionalKey(Soda3ByteRange)
}) {}
type Soda3ExportRequestEncoded = Schema.Codec.Encoded<typeof Soda3ExportRequest>
export type Soda3ExportRequestInput = Omit<Soda3ExportRequestEncoded, "format"> & {
  readonly format: WidenedStringInput<Soda3ExportRequestEncoded["format"]>
}

export class Soda3CatalogSearchRequest extends Schema.Class<Soda3CatalogSearchRequest>(
  "Soda3CatalogSearchRequest"
)({
  domain: SocrataDomain,
  query: Schema.optionalKey(Schema.String),
  limit: Schema.optionalKey(PositiveInteger),
  offset: Schema.optionalKey(NonNegativeInteger)
}) {}
export type Soda3CatalogSearchRequestInput = Schema.Codec.Encoded<typeof Soda3CatalogSearchRequest>

export class Soda3CatalogResource extends Schema.Class<Soda3CatalogResource>(
  "Soda3CatalogResource"
)({
  id: SocrataDatasetId,
  name: Schema.String,
  domain: SocrataDomain,
  type: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String)
}) {}

export class Soda3CatalogResultFragment extends Schema.Class<Soda3CatalogResultFragment>(
  "Soda3CatalogResultFragment"
)({
  resource: Soda3CatalogResource,
  metadata: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown))
}) {}

export class Soda3CatalogSearchResponse extends Schema.Class<Soda3CatalogSearchResponse>(
  "Soda3CatalogSearchResponse"
)({
  results: Schema.Array(Soda3CatalogResultFragment),
  resultCount: Schema.optionalKey(NonNegativeInteger)
}) {}
