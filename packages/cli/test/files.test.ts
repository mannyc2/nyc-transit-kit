import { describe, expect, test } from "bun:test"
import { mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import { writeResponseToFile } from "../src/commands/soda3-shared"
import { atomicWrite } from "../src/files"

const makeTempDirectory = async () => {
  const path = join(tmpdir(), `ntk-files-test-${process.pid}-${Date.now()}`)
  await mkdir(path, { recursive: true })
  return path
}

describe("CLI file helpers", () => {
  test("atomically writes response bodies", async () => {
    const directory = await makeTempDirectory()
    const path = join(directory, "response.txt")

    try {
      await atomicWrite(path, new Response("csv-body"))

      expect(await Bun.file(path).text()).toBe("csv-body")
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("atomically writes byte payloads", async () => {
    const directory = await makeTempDirectory()
    const path = join(directory, "bytes.bin")

    try {
      await atomicWrite(path, new Uint8Array([1, 2, 3]))

      expect([...new Uint8Array(await Bun.file(path).arrayBuffer())]).toEqual([1, 2, 3])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("reports metadata for written responses", async () => {
    const directory = await makeTempDirectory()
    const path = join(directory, "response.csv")

    try {
      const result = await Effect.runPromise(
        writeResponseToFile(
          path,
          new Response("csv-body", {
            status: 206,
            headers: {
              "content-length": "8",
              "content-type": "text/csv"
            }
          })
        )
      )

      expect(await Bun.file(path).text()).toBe("csv-body")
      expect(result).toEqual({
        output: path,
        status: 206,
        byteLength: 8,
        contentType: "text/csv",
        contentLength: 8
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
