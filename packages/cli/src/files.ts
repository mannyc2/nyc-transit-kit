import { rename } from "node:fs/promises"

export type AtomicWriteBody =
  | Blob
  | NodeJS.TypedArray
  | ArrayBufferLike
  | string
  | Bun.Archive
  | Response

export const atomicWrite = async (path: string, body: AtomicWriteBody) => {
  const tempPath = `${path}.tmp-${process.pid}`

  try {
    if (body instanceof Response) {
      await Bun.file(tempPath).write(body)
    } else {
      await Bun.write(tempPath, body)
    }
    await rename(tempPath, path)
  } catch (cause) {
    await Bun.file(tempPath)
      .delete()
      .catch(() => undefined)
    throw cause
  }
}
