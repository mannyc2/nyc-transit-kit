import { releaseVersion, schemaVersion } from "@nyc-transit-kit/contracts/metadata"
import { buildCommit, buildTarget } from "./build-info"

export const packageVersion = releaseVersion
export const packageBuildCommit = buildCommit
export const packageBuildTarget = buildTarget

const currentGeneratedAt = () => new Date().toISOString()

export type CliMetaApiFamily = "socrata" | "mta" | "nyc-open-data" | "nyc-dot" | "cli"

export const successEnvelope = (apiFamily: CliMetaApiFamily, data: unknown) => ({
  ok: true,
  data,
  meta: {
    apiFamily,
    generatedAt: currentGeneratedAt(),
    schemaVersion
  }
})

export const errorEnvelope = (
  apiFamily: CliMetaApiFamily,
  error: {
    readonly code: string
    readonly message: string
    readonly provider?: string
    readonly retryable?: boolean
    readonly command?: string
  }
) => ({
  ok: false,
  error,
  meta: {
    apiFamily,
    generatedAt: currentGeneratedAt(),
    schemaVersion
  }
})
