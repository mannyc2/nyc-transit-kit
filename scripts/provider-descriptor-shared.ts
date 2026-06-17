export type DescriptorProvider = "mta-open-data" | "nyc-dot" | "nyc-open-data"

export type CoverageProvider = DescriptorProvider | "mta-direct"

export const descriptorProviders = [
  "nyc-open-data",
  "nyc-dot",
  "mta-open-data"
] satisfies ReadonlyArray<DescriptorProvider>

export const coverageProviders = [
  ...descriptorProviders,
  "mta-direct"
] satisfies ReadonlyArray<CoverageProvider>

export const descriptorProviderNames = descriptorProviders.join(", ")

export const coverageProviderNames = coverageProviders.join(", ")

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const providerFrom = <Provider extends string>(
  value: string,
  providers: ReadonlyArray<Provider>,
  names: string
): Provider => {
  const provider = providers.find((candidate) => candidate === value)
  if (provider !== undefined) {
    return provider
  }
  throw new Error(`Unsupported provider ${value}. Expected one of: ${names}`)
}

export const parseDescriptorProvider = (value: string) =>
  providerFrom(value, descriptorProviders, descriptorProviderNames)

export const parseCoverageProvider = (value: string) =>
  providerFrom(value, coverageProviders, coverageProviderNames)

export const requiredArgValue = (args: ReadonlyArray<string>, index: number, flag: string) => {
  const value = args[index + 1]
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

export const catalogResource = (record: Record<string, unknown>) => {
  const resource = record.resource
  return isRecord(resource) ? resource : undefined
}

export const recordsFromSnapshot = (input: unknown): ReadonlyArray<unknown> => {
  if (Array.isArray(input)) {
    return input
  }
  if (!isRecord(input)) {
    throw new Error("Input JSON must be an array, catalog result object, or row result object")
  }

  const results = input.results
  if (Array.isArray(results)) {
    return results
  }

  const rows = input.rows
  if (Array.isArray(rows)) {
    return rows
  }

  throw new Error("Input JSON object must include an array field named results or rows")
}

export const uniqueSorted = (ids: ReadonlyArray<string>) => [...new Set(ids)].toSorted()

export const compareIds = (expectedIds: ReadonlyArray<string>, localIds: ReadonlyArray<string>) => {
  const expected = new Set(expectedIds)
  const local = new Set(localIds)
  const missingIds = expectedIds.filter((id) => !local.has(id))
  const extraIds = localIds.filter((id) => !expected.has(id))

  return {
    missingIds,
    extraIds,
    ok: missingIds.length === 0 && extraIds.length === 0
  }
}
