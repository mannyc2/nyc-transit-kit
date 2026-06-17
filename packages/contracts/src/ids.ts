import * as Schema from "effect/Schema"

const socrataDatasetIdPattern = /^[a-z0-9]{4}-[a-z0-9]{4}$/
const socrataDomainPattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

const isIsoDateValue = (value: string) => {
  const match = isoDatePattern.exec(value)
  if (match === null) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export const SocrataDatasetId = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(socrataDatasetIdPattern, {
      message: "Expected an eight-character Socrata dataset id such as abcd-1234"
    })
  ),
  Schema.brand("SocrataDatasetId")
)
export type SocrataDatasetId = typeof SocrataDatasetId.Type

export const SocrataDomain = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(socrataDomainPattern, {
      message: "Expected a Socrata domain without a protocol or path"
    })
  ),
  Schema.brand("SocrataDomain")
)
export type SocrataDomain = typeof SocrataDomain.Type

export const IsoDate = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter<string>(
      (value) => isIsoDateValue(value) || "Expected an ISO calendar date in YYYY-MM-DD format"
    )
  ),
  Schema.brand("IsoDate")
)
export type IsoDate = typeof IsoDate.Type
