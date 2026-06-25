import { lstat, rename, rm } from "node:fs/promises"

export type AtomicWriteBody =
  | Blob
  | NodeJS.TypedArray
  | ArrayBufferLike
  | string
  | Bun.Archive
  | Response

export type AtomicWriteEntry = {
  readonly path: string
  readonly body: AtomicWriteBody
}

type StagedWrite = AtomicWriteEntry & {
  readonly tempPath: string
  readonly backupPath: string
  backedUp: boolean
  committed: boolean
}

const writeBody = async (path: string, body: AtomicWriteBody) => {
  if (body instanceof Response) {
    await Bun.file(path).write(body)
  } else {
    await Bun.write(path, body)
  }
}

const removeFile = (path: string) => rm(path, { force: true }).catch(() => undefined)

const assertUniqueTargets = (entries: ReadonlyArray<AtomicWriteEntry>) => {
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.path)) {
      throw new Error(`Duplicate atomic write target: ${entry.path}`)
    }
    seen.add(entry.path)
  }
}

const backupExistingTarget = async (write: StagedWrite) => {
  try {
    const stat = await lstat(write.path)
    if (stat.isDirectory()) {
      throw new Error(`Atomic write target is a directory: ${write.path}`)
    }
    await rename(write.path, write.backupPath)
    write.backedUp = true
  } catch (cause) {
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT") {
      return
    }
    throw cause
  }
}

export const atomicWriteGroup = async (entries: ReadonlyArray<AtomicWriteEntry>) => {
  assertUniqueTargets(entries)
  const batchId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const writes = entries.map((entry, index) => ({
    ...entry,
    tempPath: `${entry.path}.tmp-${batchId}-${index}`,
    backupPath: `${entry.path}.bak-${batchId}-${index}`,
    backedUp: false,
    committed: false
  }))

  try {
    for (const write of writes) {
      await writeBody(write.tempPath, write.body)
    }

    for (const write of writes) {
      await backupExistingTarget(write)
      await rename(write.tempPath, write.path)
      write.committed = true
    }

    for (const write of writes) {
      if (write.backedUp) {
        await removeFile(write.backupPath)
      }
    }
  } catch (cause) {
    for (const write of writes.toReversed()) {
      if (write.committed) {
        await removeFile(write.path)
      }
      if (write.backedUp) {
        await rename(write.backupPath, write.path).catch(() => undefined)
      }
      await removeFile(write.tempPath)
    }
    throw cause
  }
}

export const atomicWrite = async (path: string, body: AtomicWriteBody) =>
  atomicWriteGroup([{ path, body }])
