import { IsoDate } from "@nyc-transit-kit/contracts/ids"
import { PositiveInteger } from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { InvalidInputError } from "./errors"
import { decodeInput } from "./internal/decode"
export const soqlSelectAll = "SELECT *"
export type SoqlParameters = Readonly<Record<string, unknown>>
export type SoqlFragment = Readonly<{ text: string; parameters?: SoqlParameters }>
export type SocrataTimestampWindow = Readonly<{ start: string; end: string }>
export type SocrataYearMonth = Readonly<{ year: number; month: number }>
const fn = Effect.fn
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const parameterPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const patternString = (pattern: RegExp, message: string) =>
  Schema.String.pipe(Schema.check(Schema.isPattern(pattern, { message })))
const SoqlIdentifier = patternString(
  identifierPattern,
  "Expected a SoQL identifier such as route_id"
)
const SoqlParameterName = patternString(
  parameterPattern,
  "Expected a SoQL parameter name such as route"
)
const SoqlSortDirection = Schema.Literals(["ASC", "DESC"])
export type SoqlSortDirection = typeof SoqlSortDirection.Type
const intRange = (minimum: number, maximum: number) =>
  Schema.Int.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(minimum)),
    Schema.check(Schema.isLessThanOrEqualTo(maximum))
  )
const SocrataYear = intRange(1900, 9999)
const SocrataMonth = intRange(1, 12)
const SocrataYearMonthSchema = Schema.Struct({ year: SocrataYear, month: SocrataMonth })
const invalidQueryInput = (message: string) =>
  InvalidInputError.make({ operation: "query", message })
const decode = <S extends Schema.Top>(schema: S) => decodeInput("query", schema)
const decodeLimit = decode(PositiveInteger)
const decodeIdentifier = decode(SoqlIdentifier)
const decodeParameterName = decode(SoqlParameterName)
const decodeSortDirection = decode(SoqlSortDirection)
const decodeIsoDate = decode(IsoDate)
const decodeYear = decode(SocrataYear)
const decodeMonth = decode(SocrataMonth)
const decodeYearMonth = decode(SocrataYearMonthSchema)
const fragment = (text: string, parameters?: SoqlParameters): SoqlFragment =>
  parameters === undefined ? { text } : { text, parameters }
const mergeParameters = (fragments: ReadonlyArray<SoqlFragment>) => {
  const parameters: Record<string, unknown> = {}
  for (const part of fragments) {
    for (const [key, value] of Object.entries(part.parameters ?? {})) {
      if (Object.hasOwn(parameters, key)) {
        return Effect.fail(invalidQueryInput(`Duplicate SoQL parameter name: ${key}`))
      }
      parameters[key] = value
    }
  }
  return Effect.succeed(Object.keys(parameters).length === 0 ? undefined : parameters)
}
const dateMessage = "Expected an ISO calendar date in YYYY-MM-DD format"
const pad = (value: number, length: number) => value.toString().padStart(length, "0")
const timestampFromParts = (year: number, month: number, day: number) =>
  `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T00:00:00`
const datePartsOf = (value: string) => {
  const [, yearText, monthText, dayText] = datePattern.exec(value) ?? []
  return yearText === undefined || monthText === undefined || dayText === undefined
    ? Effect.fail(invalidQueryInput(dateMessage))
    : Effect.succeed({ year: +yearText, month: +monthText, day: +dayText })
}
export const soqlLimit = fn("Soda3.soqlLimit")(function* (query: string, limit: unknown) {
  return `${query} LIMIT ${yield* decodeLimit(limit)}`
})
export const soqlIdentifier = fn("Soda3.soqlIdentifier")(function* (input: unknown) {
  return yield* decodeIdentifier(input)
})
export const soqlParameterName = fn("Soda3.soqlParameterName")(function* (input: unknown) {
  return yield* decodeParameterName(input)
})
export const soqlParameter = fn("Soda3.soqlParameter")(function* (name: unknown, value: unknown) {
  const key = yield* decodeParameterName(name)
  return fragment(`:${key}`, { [key]: value })
})
export const soqlEq = fn("Soda3.soqlEq")(function* (
  column: unknown,
  parameterName: unknown,
  value: unknown
) {
  const col = yield* decodeIdentifier(column)
  const key = yield* decodeParameterName(parameterName)
  return fragment(`${col} = :${key}`, { [key]: value })
})
export const soqlIn = fn("Soda3.soqlIn")(function* (
  column: unknown,
  parameterBaseName: unknown,
  values: ReadonlyArray<unknown>
) {
  if (values.length === 0) {
    return yield* invalidQueryInput("SoQL IN predicates require at least one value")
  }
  const col = yield* decodeIdentifier(column)
  const base = yield* decodeParameterName(parameterBaseName)
  const parameters: Record<string, unknown> = {}
  const placeholders: Array<string> = []
  for (let index = 0; index < values.length; index += 1) {
    const key = `${base}_${index + 1}`
    parameters[key] = values[index]
    placeholders.push(`:${key}`)
  }
  return fragment(`${col} IN (${placeholders.join(", ")})`, parameters)
})
export const soqlIsNotNull = fn("Soda3.soqlIsNotNull")(function* (column: unknown) {
  return fragment(`${yield* decodeIdentifier(column)} IS NOT NULL`)
})
export const soqlAnd = fn("Soda3.soqlAnd")(function* (fragments: ReadonlyArray<SoqlFragment>) {
  if (fragments.length === 0) {
    return yield* invalidQueryInput("SoQL AND composition requires at least one fragment")
  }
  return fragment(
    fragments.map((part) => `(${part.text})`).join(" AND "),
    yield* mergeParameters(fragments)
  )
})
export const soqlOrderBy = fn("Soda3.soqlOrderBy")(function* (
  column: unknown,
  direction: unknown = "ASC"
) {
  const col = yield* decodeIdentifier(column)
  return fragment(`ORDER BY ${col} ${yield* decodeSortDirection(direction)}`)
})
export const socrataTimestamp = fn("Soda3.socrataTimestamp")(function* (date: string | Date) {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) {
      return yield* invalidQueryInput("Expected a valid Date")
    }
    return timestampFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }
  const decodedDate = yield* decodeIsoDate(date)
  const parts = yield* datePartsOf(decodedDate)
  return timestampFromParts(parts.year, parts.month, parts.day)
})
export const socrataMonthWindow = fn("Soda3.socrataMonthWindow")(function* (
  year: unknown,
  month: unknown
) {
  const y = yield* decodeYear(year)
  const m = yield* decodeMonth(month)
  const endYear = m === 12 ? y + 1 : y
  const endMonth = m === 12 ? 1 : m + 1
  return {
    start: timestampFromParts(y, m, 1),
    end: timestampFromParts(endYear, endMonth, 1)
  }
})
export const socrataDateWindow = fn("Soda3.socrataDateWindow")(function* (
  startDate: unknown,
  endDate: unknown
) {
  const start = yield* datePartsOf(yield* decodeIsoDate(startDate))
  const end = yield* datePartsOf(yield* decodeIsoDate(endDate))
  if (
    Date.UTC(start.year, start.month - 1, start.day) >= Date.UTC(end.year, end.month - 1, end.day)
  ) {
    return yield* invalidQueryInput("Socrata date windows require startDate before endDate")
  }
  return {
    start: timestampFromParts(start.year, start.month, start.day),
    end: timestampFromParts(end.year, end.month, end.day)
  }
})
export const soqlTimestampRange = fn("Soda3.soqlTimestampRange")(function* (
  column: unknown,
  startParameterName: unknown,
  endParameterName: unknown,
  w: SocrataTimestampWindow
) {
  const col = yield* decodeIdentifier(column)
  const s = yield* decodeParameterName(startParameterName)
  const e = yield* decodeParameterName(endParameterName)
  if (s === e) {
    return yield* invalidQueryInput(`Duplicate SoQL parameter name: ${s}`)
  }
  return fragment(`${col} >= :${s} AND ${col} < :${e}`, { [s]: w.start, [e]: w.end })
})
export const soqlMonthWindow = fn("Soda3.soqlMonthWindow")(function* (
  column: unknown,
  year: unknown,
  month: unknown,
  parameterBaseName: unknown
) {
  const base = yield* decodeParameterName(parameterBaseName)
  const window = yield* socrataMonthWindow(year, month)
  return yield* soqlTimestampRange(column, `${base}_start`, `${base}_end`, window)
})
export const soqlYearMonthRange = fn("Soda3.soqlYearMonthRange")(function* (
  yearColumn: unknown,
  monthColumn: unknown,
  start: unknown,
  end: unknown
) {
  const yearCol = yield* decodeIdentifier(yearColumn)
  const monthCol = yield* decodeIdentifier(monthColumn)
  const rs = yield* decodeYearMonth(start)
  const re = yield* decodeYearMonth(end)
  const startOrder = rs.year * 12 + rs.month
  const endOrder = re.year * 12 + re.month
  if (startOrder > endOrder) {
    return yield* invalidQueryInput("SoQL year/month ranges require start before end")
  }
  return fragment(
    `(${yearCol} > :start_year OR (${yearCol} = :start_year AND ${monthCol} >= :start_month)) AND (${yearCol} < :end_year OR (${yearCol} = :end_year AND ${monthCol} <= :end_month))`,
    { start_year: rs.year, start_month: rs.month, end_year: re.year, end_month: re.month }
  )
})
