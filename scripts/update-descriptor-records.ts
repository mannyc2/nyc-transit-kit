import * as Schema from "effect/Schema"
import { makeDescriptorRegistry } from "../packages/contracts/src/descriptor-registry"
import type { DatasetDescriptorAdapterStatus } from "../packages/contracts/src/metadata"
import type { MtaOpenDataDatasetDescriptorInput } from "../packages/contracts/src/mta"
import { MtaOpenDataDatasetDescriptor } from "../packages/contracts/src/mta"
import type { NycDotDatasetDescriptorInput } from "../packages/contracts/src/nyc-dot"
import { NycDotDatasetDescriptor } from "../packages/contracts/src/nyc-dot"
import type { NycOpenDataDatasetDescriptorInput } from "../packages/contracts/src/nyc-open-data"
import { NycOpenDataDatasetDescriptor } from "../packages/contracts/src/nyc-open-data"
import {
  catalogResource,
  type DescriptorProvider,
  descriptorProviderNames,
  isRecord,
  parseDescriptorProvider,
  requiredArgValue
} from "./provider-descriptor-shared"

type CliConfig = {
  readonly provider: DescriptorProvider
  readonly inputPath: string
  readonly write: boolean
}

type DescriptorMetadataInput = {
  readonly sourceUrl?: string
  readonly tags?: ReadonlyArray<string>
  readonly temporalFields?: ReadonlyArray<string>
  readonly adapterStatus?: DatasetDescriptorAdapterStatus
  readonly lastVerified?: string
}

const parseArgs = (args: ReadonlyArray<string>): CliConfig => {
  let provider: DescriptorProvider | undefined
  let inputPath: string | undefined
  let write = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === undefined) {
      continue
    }

    switch (arg) {
      case "--provider":
        provider = parseDescriptorProvider(requiredArgValue(args, index, arg))
        index += 1
        break
      case "--input":
        inputPath = requiredArgValue(args, index, arg)
        index += 1
        break
      case "--write":
        write = true
        break
      default:
        throw new Error(`Unsupported argument ${arg}`)
    }
  }

  if (provider === undefined) {
    throw new Error(`Missing --provider. Expected one of: ${descriptorProviderNames}`)
  }
  if (inputPath === undefined) {
    throw new Error("Missing --input")
  }

  return {
    provider,
    inputPath,
    write
  }
}

const readString = (record: Record<string, unknown>, key: string, context: string) => {
  const value = record[key]
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} must include string field ${key}`)
  }
  return value
}

const readOptionalString = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== "string") {
    throw new Error(`Optional field ${key} must be a string when provided`)
  }
  return value.length === 0 ? undefined : value
}

const readOptionalStringArray = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value)) {
    throw new Error(`Optional field ${key} must be a string array when provided`)
  }

  const values: Array<string> = []
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.length === 0) {
      throw new Error(`Optional field ${key}[${index}] must be a non-empty string`)
    }
    values.push(item)
  }

  return values.length === 0 ? undefined : values
}

const readOptionalAdapterStatus = (
  record: Record<string, unknown>
): DatasetDescriptorAdapterStatus | undefined => {
  const value = readOptionalString(record, "adapterStatus")
  if (value === undefined) {
    return undefined
  }
  if (value === "none" || value === "row-schema" || value === "normalized") {
    return value
  }
  throw new Error(`Optional field adapterStatus must be none, row-schema, or normalized`)
}

const metadataFrom = (record: Record<string, unknown>): DescriptorMetadataInput => {
  const sourceUrl = readOptionalString(record, "sourceUrl")
  const tags = readOptionalStringArray(record, "tags")
  const temporalFields = readOptionalStringArray(record, "temporalFields")
  const adapterStatus = readOptionalAdapterStatus(record)
  const lastVerified = readOptionalString(record, "lastVerified")

  return {
    ...(sourceUrl === undefined ? {} : { sourceUrl }),
    ...(tags === undefined ? {} : { tags }),
    ...(temporalFields === undefined ? {} : { temporalFields }),
    ...(adapterStatus === undefined ? {} : { adapterStatus }),
    ...(lastVerified === undefined ? {} : { lastVerified })
  }
}

const readBacking = (record: Record<string, unknown>) => {
  const backing = readOptionalString(record, "backing") ?? "socrata"
  if (backing !== "socrata") {
    throw new Error(`Descriptor backing must be socrata, received ${backing}`)
  }
  return backing
}

const sourceRecord = (input: unknown, context: string) => {
  if (!isRecord(input)) {
    throw new Error(`${context} must be an object`)
  }
  return {
    record: input,
    source: catalogResource(input) ?? input
  }
}

const descriptionFrom = (record: Record<string, unknown>, source: Record<string, unknown>) =>
  readOptionalString(record, "description") ?? readOptionalString(source, "description")

const toLowerKebab = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (slug.length === 0) {
    throw new Error(`Cannot derive a lower-kebab descriptor name from ${value}`)
  }
  return slug
}

const normalizeNycOpenDataRecord = (
  input: unknown,
  index: number
): NycOpenDataDatasetDescriptorInput => {
  const context = `NYC Open Data descriptor at index ${index}`
  const { record, source } = sourceRecord(input, context)
  const agency = readOptionalString(record, "agency")
  const description = descriptionFrom(record, source)
  const metadata = metadataFrom(record)

  return {
    id: readString(source, "id", context),
    name: readString(source, "name", context),
    domain: readString(source, "domain", context),
    backing: readBacking(record),
    ...(agency === undefined ? {} : { agency }),
    ...(description === undefined ? {} : { description }),
    ...metadata
  }
}

const normalizeNycDotRecord = (input: unknown, index: number): NycDotDatasetDescriptorInput => {
  const context = `NYC DOT descriptor at index ${index}`
  const { record, source } = sourceRecord(input, context)
  const title = readOptionalString(record, "title") ?? readString(source, "name", context)
  const name = readOptionalString(record, "name") ?? toLowerKebab(title)
  const description = descriptionFrom(record, source)
  const metadata = metadataFrom(record)

  return {
    name,
    id: readString(source, "id", context),
    title,
    domain: readString(source, "domain", context),
    backing: readBacking(record),
    ...(description === undefined ? {} : { description }),
    ...metadata
  }
}

const normalizeMtaOpenDataRecord = (
  input: unknown,
  index: number
): MtaOpenDataDatasetDescriptorInput => {
  const context = `MTA Open Data descriptor at index ${index}`
  const { record, source } = sourceRecord(input, context)
  const description = descriptionFrom(record, source)
  const metadata = metadataFrom(record)

  return {
    id: readString(source, "id", context),
    name: readString(source, "name", context),
    domain: readString(source, "domain", context),
    backing: readBacking(record),
    ...(description === undefined ? {} : { description }),
    ...metadata
  }
}

const sortByNameThenId = <Record extends { readonly id: string; readonly name: string }>(
  records: ReadonlyArray<Record>
) =>
  [...records].sort(
    (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  )

const stringLiteral = (value: string) => JSON.stringify(value)

const arrayLiteral = (values: ReadonlyArray<string>) =>
  `[${values.map((value) => stringLiteral(value)).join(", ")}]`

const formatObject = (fields: ReadonlyArray<readonly [string, string]>) =>
  [
    "  {",
    ...fields.map(
      ([key, value], index) => `    ${key}: ${value}${index === fields.length - 1 ? "" : ","}`
    ),
    "  }"
  ].join("\n")

const optionalField = (fields: Array<readonly [string, string]>, key: string, value: string) => {
  if (value.length > 0) {
    fields.push([key, stringLiteral(value)])
  }
}

const optionalArrayField = (
  fields: Array<readonly [string, string]>,
  key: string,
  value: ReadonlyArray<string> | undefined
) => {
  if (value !== undefined && value.length > 0) {
    fields.push([key, arrayLiteral(value)])
  }
}

const optionalMetadataFields = (
  fields: Array<readonly [string, string]>,
  record: DescriptorMetadataInput
) => {
  optionalField(fields, "sourceUrl", record.sourceUrl ?? "")
  optionalArrayField(fields, "tags", record.tags)
  optionalArrayField(fields, "temporalFields", record.temporalFields)
  optionalField(fields, "adapterStatus", record.adapterStatus ?? "")
  optionalField(fields, "lastVerified", record.lastVerified ?? "")
}

const formatNycOpenDataRecord = (record: NycOpenDataDatasetDescriptorInput) => {
  const fields: Array<readonly [string, string]> = [
    ["id", stringLiteral(record.id)],
    ["name", stringLiteral(record.name)],
    ["domain", stringLiteral(record.domain)]
  ]
  optionalField(fields, "agency", record.agency ?? "")
  fields.push(["backing", stringLiteral(record.backing)])
  optionalField(fields, "description", record.description ?? "")
  optionalMetadataFields(fields, record)
  return formatObject(fields)
}

const formatNycDotRecord = (record: NycDotDatasetDescriptorInput) => {
  const fields: Array<readonly [string, string]> = [
    ["name", stringLiteral(record.name)],
    ["id", stringLiteral(record.id)],
    ["title", stringLiteral(record.title)],
    ["domain", stringLiteral(record.domain)],
    ["backing", stringLiteral(record.backing)]
  ]
  optionalField(fields, "description", record.description ?? "")
  optionalMetadataFields(fields, record)
  return formatObject(fields)
}

const formatMtaOpenDataRecord = (record: MtaOpenDataDatasetDescriptorInput) => {
  const fields: Array<readonly [string, string]> = [
    ["id", stringLiteral(record.id)],
    ["name", stringLiteral(record.name)],
    ["domain", stringLiteral(record.domain)],
    ["backing", stringLiteral(record.backing)]
  ]
  optionalField(fields, "description", record.description ?? "")
  optionalMetadataFields(fields, record)
  return formatObject(fields)
}

const moduleText = (
  typeName: string,
  importPath: string,
  exportName: string,
  formattedRecords: ReadonlyArray<string>
) =>
  [
    `import type { ${typeName} } from "${importPath}"`,
    "",
    `export const ${exportName} = [`,
    formattedRecords.join(",\n"),
    `] satisfies ReadonlyArray<${typeName}>`,
    ""
  ].join("\n")

const normalizeArray = (input: unknown) => {
  if (!Array.isArray(input)) {
    throw new Error("Input JSON must be an array of descriptor records")
  }
  return input
}

const nycOpenDataTarget = new URL(
  "../packages/nyc-open-data/src/internal/descriptor-records.ts",
  import.meta.url
).pathname
const nycDotTarget = new URL(
  "../packages/nyc-dot/src/internal/descriptor-records.ts",
  import.meta.url
).pathname
const mtaOpenDataTarget = new URL(
  "../packages/mta/src/internal/open-data-descriptor-records.ts",
  import.meta.url
).pathname

const prepareDescriptorRecords = <
  Record extends { readonly id: string; readonly name: string },
  Descriptor extends { readonly id: unknown }
>(config: {
  readonly input: ReadonlyArray<unknown>
  readonly normalize: (input: unknown, index: number) => Record
  readonly decodeDescriptor: (record: Record) => Descriptor
  readonly lookupKeys?: (descriptor: Descriptor) => ReadonlyArray<string>
  readonly targetPath: string
  readonly typeName: string
  readonly importPath: string
  readonly exportName: string
  readonly formatRecord: (record: Record) => string
}) => {
  const records = sortByNameThenId(config.input.map(config.normalize))
  const descriptors = records.map(config.decodeDescriptor)

  makeDescriptorRegistry({
    descriptors,
    id: (descriptor) => String(descriptor.id),
    ...(config.lookupKeys === undefined ? {} : { lookupKeys: config.lookupKeys })
  })

  return {
    targetPath: config.targetPath,
    records,
    content: moduleText(
      config.typeName,
      config.importPath,
      config.exportName,
      records.map(config.formatRecord)
    )
  }
}

export const prepareNycOpenData = (input: ReadonlyArray<unknown>) =>
  prepareDescriptorRecords({
    input,
    normalize: normalizeNycOpenDataRecord,
    decodeDescriptor: Schema.decodeUnknownSync(NycOpenDataDatasetDescriptor),
    targetPath: nycOpenDataTarget,
    typeName: "NycOpenDataDatasetDescriptorInput",
    importPath: "@nyc-transit-kit/contracts/nyc-open-data",
    exportName: "nycOpenDataDescriptorRecords",
    formatRecord: formatNycOpenDataRecord
  })

export const prepareNycDot = (input: ReadonlyArray<unknown>) =>
  prepareDescriptorRecords({
    input,
    normalize: normalizeNycDotRecord,
    decodeDescriptor: Schema.decodeUnknownSync(NycDotDatasetDescriptor),
    lookupKeys: (descriptor) => [String(descriptor.name)],
    targetPath: nycDotTarget,
    typeName: "NycDotDatasetDescriptorInput",
    importPath: "@nyc-transit-kit/contracts/nyc-dot",
    exportName: "nycDotDescriptorRecords",
    formatRecord: formatNycDotRecord
  })

export const prepareMtaOpenData = (input: ReadonlyArray<unknown>) =>
  prepareDescriptorRecords({
    input,
    normalize: normalizeMtaOpenDataRecord,
    decodeDescriptor: Schema.decodeUnknownSync(MtaOpenDataDatasetDescriptor),
    targetPath: mtaOpenDataTarget,
    typeName: "MtaOpenDataDatasetDescriptorInput",
    importPath: "@nyc-transit-kit/contracts/mta",
    exportName: "mtaOpenDataDescriptorRecords",
    formatRecord: formatMtaOpenDataRecord
  })

export const prepareProvider = (provider: DescriptorProvider, input: ReadonlyArray<unknown>) => {
  switch (provider) {
    case "mta-open-data":
      return prepareMtaOpenData(input)
    case "nyc-dot":
      return prepareNycDot(input)
    case "nyc-open-data":
      return prepareNycOpenData(input)
  }
}

const main = async () => {
  const config = parseArgs(Bun.argv.slice(2))
  const parsed: unknown = JSON.parse(await Bun.file(config.inputPath).text())
  const prepared = prepareProvider(config.provider, normalizeArray(parsed))

  if (config.write) {
    await Bun.write(prepared.targetPath, prepared.content)
  }

  console.log(
    JSON.stringify(
      {
        provider: config.provider,
        input: config.inputPath,
        target: prepared.targetPath,
        count: prepared.records.length,
        write: config.write
      },
      null,
      2
    )
  )
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
