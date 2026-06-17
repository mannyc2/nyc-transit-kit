import type { Soda3ExportFormat } from "@nyc-transit-kit/contracts/soda3"
import { buildExportUrl, buildQueryUrl } from "@nyc-transit-kit/soda3/endpoints"
import * as Effect from "effect/Effect"
import { atomicWrite } from "../files"
import { runEffect } from "./shared"
import type { ApiFamily, CommandContext } from "./types"

type DryRunExtra = Readonly<Record<string, unknown>>

export const fileWriteError = (cause: unknown) => ({
  _tag: "FileWriteError",
  message: cause instanceof Error ? cause.message : "File write failed."
})

const optionalHeader = (headers: Headers, name: string) => headers.get(name) ?? undefined

const parseContentLength = (value: string | undefined) => {
  if (value === undefined) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

export const writeSoda3QueryDryRun = (config: {
  readonly context: CommandContext
  readonly apiFamily: ApiFamily
  readonly tokens: ReadonlyArray<string>
  readonly domain: string
  readonly datasetId: string
  readonly query: string
  readonly extra?: DryRunExtra
}) =>
  runEffect(
    config.context,
    config.apiFamily,
    config.tokens,
    buildQueryUrl({
      domain: config.domain,
      datasetId: config.datasetId,
      query: config.query
    }).pipe(
      Effect.map((url) => ({
        dryRun: true,
        method: "POST",
        url: url.toString(),
        ...config.extra,
        body: {
          query: config.query
        }
      }))
    )
  )

export const writeSoda3ExportDryRun = (config: {
  readonly context: CommandContext
  readonly apiFamily: ApiFamily
  readonly tokens: ReadonlyArray<string>
  readonly domain: string
  readonly datasetId: string
  readonly format: Soda3ExportFormat
  readonly output: string
  readonly extra?: DryRunExtra
}) =>
  runEffect(
    config.context,
    config.apiFamily,
    config.tokens,
    buildExportUrl({
      domain: config.domain,
      datasetId: config.datasetId,
      format: config.format
    }).pipe(
      Effect.map((url) => ({
        dryRun: true,
        method: "POST",
        url: url.toString(),
        ...config.extra,
        output: config.output
      }))
    )
  )

export const writeResponseToFile = (output: string, response: Response) =>
  Effect.gen(function* () {
    const contentType = optionalHeader(response.headers, "content-type")
    const contentLength = parseContentLength(optionalHeader(response.headers, "content-length"))

    yield* Effect.tryPromise({
      try: () => atomicWrite(output, response),
      catch: fileWriteError
    })
    const byteLength = yield* Effect.sync(() => Bun.file(output).size)

    return {
      output,
      status: response.status,
      byteLength,
      ...(contentType === undefined ? {} : { contentType }),
      ...(contentLength === undefined ? {} : { contentLength })
    }
  })
