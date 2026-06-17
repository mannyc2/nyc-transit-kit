export type DescriptorRegistryOptions<Descriptor> = {
  readonly descriptors: ReadonlyArray<Descriptor>
  readonly id: (descriptor: Descriptor) => string
  readonly lookupKeys?: (descriptor: Descriptor) => ReadonlyArray<string>
}

export type DescriptorRegistry<Descriptor> = {
  readonly all: ReadonlyArray<Descriptor>
  readonly ids: ReadonlyArray<string>
  readonly findById: (id: string) => Descriptor | undefined
  readonly find: (key: string) => Descriptor | undefined
}

const duplicateError = (kind: string, key: string) =>
  new Error(`Duplicate descriptor ${kind}: ${key}`)

export const makeDescriptorRegistry = <Descriptor>(
  options: DescriptorRegistryOptions<Descriptor>
): DescriptorRegistry<Descriptor> => {
  const all = [...options.descriptors]
  const ids: Array<string> = []
  const byId = new Map<string, Descriptor>()
  const byLookupKey = new Map<string, Descriptor>()

  const addLookupKey = (key: string, descriptor: Descriptor) => {
    if (byLookupKey.has(key)) {
      throw duplicateError("lookup key", key)
    }
    byLookupKey.set(key, descriptor)
  }

  for (const descriptor of all) {
    const id = options.id(descriptor)
    if (byId.has(id)) {
      throw duplicateError("id", id)
    }
    byId.set(id, descriptor)
    ids.push(id)
    addLookupKey(id, descriptor)

    for (const key of options.lookupKeys?.(descriptor) ?? []) {
      addLookupKey(key, descriptor)
    }
  }

  return {
    all,
    ids,
    findById: (id) => byId.get(id),
    find: (key) => byLookupKey.get(key)
  }
}
