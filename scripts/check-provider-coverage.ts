import { mtaOpenDataDatasets } from "../packages/mta/src/datasets"
import { mtaDirectFeeds } from "../packages/mta/src/feeds"
import { nycDotDatasets } from "../packages/nyc-dot/src/datasets"
import { knownNycOpenDataDatasets } from "../packages/nyc-open-data/src/descriptors"
import {
  type CoverageProvider,
  catalogResource,
  compareIds,
  coverageProviderNames,
  isRecord,
  parseCoverageProvider,
  recordsFromSnapshot,
  requiredArgValue,
  uniqueSorted
} from "./provider-descriptor-shared"

type CliConfig = {
  readonly provider: CoverageProvider
  readonly inputPath: string
}

const socrataDatasetIdPattern = /\b[a-z0-9]{4}-[a-z0-9]{4}\b/
const preferredIdFields = [
  "id",
  "datasetId",
  "dataset_id",
  "openDatasetId",
  "open_dataset_id",
  "Open Dataset ID",
  "Open Data Dataset ID",
  "Dataset ID"
]

const parseArgs = (args: ReadonlyArray<string>): CliConfig => {
  let provider: CoverageProvider | undefined
  let inputPath: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === undefined) {
      continue
    }

    switch (arg) {
      case "--provider":
        provider = parseCoverageProvider(requiredArgValue(args, index, arg))
        index += 1
        break
      case "--input":
        inputPath = requiredArgValue(args, index, arg)
        index += 1
        break
      default:
        throw new Error(`Unsupported argument ${arg}`)
    }
  }

  if (provider === undefined) {
    throw new Error(`Missing --provider. Expected one of: ${coverageProviderNames}`)
  }
  if (inputPath === undefined) {
    throw new Error("Missing --input")
  }

  return {
    provider,
    inputPath
  }
}

const localIdsFor = (provider: CoverageProvider) => {
  switch (provider) {
    case "mta-direct":
      return mtaDirectFeeds.map((feed) => feed.id)
    case "mta-open-data":
      return mtaOpenDataDatasets.map((descriptor) => String(descriptor.id))
    case "nyc-dot":
      return nycDotDatasets.map((descriptor) => String(descriptor.id))
    case "nyc-open-data":
      return knownNycOpenDataDatasets.map((descriptor) => String(descriptor.id))
  }
}

const datasetIdFromString = (value: string) => value.match(socrataDatasetIdPattern)?.[0]

const datasetIdFromValue = (value: unknown) =>
  typeof value === "string" ? datasetIdFromString(value) : undefined

const datasetIdFromRecord = (record: Record<string, unknown>, index: number) => {
  const source = catalogResource(record) ?? record

  for (const field of preferredIdFields) {
    const id = datasetIdFromValue(source[field]) ?? datasetIdFromValue(record[field])
    if (id !== undefined) {
      return id
    }
  }

  for (const value of [...Object.values(source), ...Object.values(record)]) {
    const id = datasetIdFromValue(value)
    if (id !== undefined) {
      return id
    }
  }

  throw new Error(`Could not derive a Socrata dataset id from source record at index ${index}`)
}

const mtaDirectFeedIdFromRecord = (record: Record<string, unknown>, index: number) => {
  const id = record.id
  if (typeof id === "string" && id.length > 0) {
    return id
  }

  throw new Error(`MTA direct source record at index ${index} must include string field id`)
}

const expectedIdFromInput = (provider: CoverageProvider, input: unknown, index: number) => {
  if (!isRecord(input)) {
    throw new Error(`Source record at index ${index} must be an object`)
  }
  if (provider === "mta-direct") {
    return mtaDirectFeedIdFromRecord(input, index)
  }
  return datasetIdFromRecord(input, index)
}

const main = async () => {
  const config = parseArgs(Bun.argv.slice(2))
  const parsed: unknown = JSON.parse(await Bun.file(config.inputPath).text())
  const records = recordsFromSnapshot(parsed)
  const expectedIds = uniqueSorted(
    records.map((record, index) => expectedIdFromInput(config.provider, record, index))
  )
  const localIds = uniqueSorted(localIdsFor(config.provider))
  const comparison = compareIds(expectedIds, localIds)
  const result = {
    provider: config.provider,
    expectedCount: expectedIds.length,
    localCount: localIds.length,
    missingIds: comparison.missingIds,
    extraIds: comparison.extraIds,
    ok: comparison.ok
  }

  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) {
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
