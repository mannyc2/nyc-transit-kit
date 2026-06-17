import { IsoDate } from "@nyc-transit-kit/contracts/ids"
import { PositiveInteger } from "@nyc-transit-kit/contracts/soda3"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { InvalidInputError } from "./errors"

export const soqlSelectAll = "SELECT *"

export type SoqlParameters = Readonly<Record<string, unknown>>

export type SoqlFragment = {
  readonly text: string
  readonly parameters?: SoqlParameters
}

export type SocrataTimestampWindow = {
  readonly start: string
  readonly end: string
}

export type SocrataYearMonth = {
  readonly year: number
  readonly month: number
}

const soqlIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const soqlParameterNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const isoDatePartsPattern = /^(\d{4})-(\d{2})-(\d{2})$/

const SoqlIdentifier = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(soqlIdentifierPattern, {
      message: "Expected a SoQL identifier such as route_id"
    })
  )
)

const SoqlParameterName = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(soqlParameterNamePattern, {
      message: "Expected a SoQL parameter name such as route"
    })
  )
)

const SoqlSortDirection = Schema.Literals(["ASC", "DESC"])
export type SoqlSortDirection = typeof SoqlSortDirection.Type

const SocrataYear = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(1900)),
  Schema.check(Schema.isLessThanOrEqualTo(9999))
)

const SocrataMonth = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(1)),
  Schema.check(Schema.isLessThanOrEqualTo(12))
)

const SocrataYearMonthSchema = Schema.Struct({
  year: SocrataYear,
  month: SocrataMonth
})

const invalidQueryInput = (message: string) =>
  InvalidInputError.make({
    operation: "query",
    message
  })

const decodeQueryInput =
  <S extends Schema.Top>(schema: S) =>
  (input: unknown) =>
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.catchTag("SchemaError", (error) => Effect.fail(invalidQueryInput(error.message)))
    )

const decodeLimit = decodeQueryInput(PositiveInteger)
const decodeIdentifier = decodeQueryInput(SoqlIdentifier)
const decodeParameterName = decodeQueryInput(SoqlParameterName)
const decodeSortDirection = decodeQueryInput(SoqlSortDirection)
const decodeIsoDate = decodeQueryInput(IsoDate)
const decodeYear = decodeQueryInput(SocrataYear)
const decodeMonth = decodeQueryInput(SocrataMonth)
const decodeYearMonth = decodeQueryInput(SocrataYearMonthSchema)

const withParameters = (
  text: string,
  parameters: Readonly<Record<string, unknown>>
): SoqlFragment => ({
  text,
  parameters
})

const withoutParameters = (text: string): SoqlFragment => ({
  text
})

const mergeParameters = (fragments: ReadonlyArray<SoqlFragment>) =>
  Effect.gen(function* () {
    const parameters: Record<string, unknown> = {}

    for (const fragment of fragments) {
      for (const [key, value] of Object.entries(fragment.parameters ?? {})) {
        if (Object.hasOwn(parameters, key)) {
          return yield* invalidQueryInput(`Duplicate SoQL parameter name: ${key}`)
        }
        parameters[key] = value
      }
    }

    return Object.keys(parameters).length === 0 ? undefined : parameters
  })

const pad2 = (value: number) => value.toString().padStart(2, "0")

const timestampFromParts = (year: number, month: number, day: number) =>
  `${year.toString().padStart(4, "0")}-${pad2(month)}-${pad2(day)}T00:00:00`

const dateParts = (value: string) =>
  Effect.gen(function* () {
    const match = isoDatePartsPattern.exec(value)
    if (match === null) {
      return yield* invalidQueryInput("Expected an ISO calendar date in YYYY-MM-DD format")
    }

    const yearText = match[1]
    const monthText = match[2]
    const dayText = match[3]
    if (yearText === undefined || monthText === undefined || dayText === undefined) {
      return yield* invalidQueryInput("Expected an ISO calendar date in YYYY-MM-DD format")
    }

    return {
      year: Number(yearText),
      month: Number(monthText),
      day: Number(dayText)
    }
  })

const utcTimestampFromDate = (date: Date) =>
  Effect.gen(function* () {
    if (Number.isNaN(date.getTime())) {
      return yield* invalidQueryInput("Expected a valid Date")
    }

    return timestampFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  })

const epochDay = (value: string) =>
  Effect.gen(function* () {
    const parts = yield* dateParts(value)
    return Date.UTC(parts.year, parts.month - 1, parts.day)
  })

export const soqlLimit = Effect.fn("Soda3.soqlLimit")(function* (query: string, limit: unknown) {
  const decodedLimit = yield* decodeLimit(limit)
  return `${query} LIMIT ${decodedLimit}`
})

export const soqlIdentifier = Effect.fn("Soda3.soqlIdentifier")(function* (input: unknown) {
  return yield* decodeIdentifier(input)
})

export const soqlParameterName = Effect.fn("Soda3.soqlParameterName")(function* (input: unknown) {
  return yield* decodeParameterName(input)
})

export const soqlParameter = Effect.fn("Soda3.soqlParameter")(function* (
  name: unknown,
  value: unknown
) {
  const decodedName = yield* decodeParameterName(name)
  return withParameters(`:${decodedName}`, {
    [decodedName]: value
  })
})

export const soqlEq = Effect.fn("Soda3.soqlEq")(function* (
  column: unknown,
  parameterName: unknown,
  value: unknown
) {
  const decodedColumn = yield* decodeIdentifier(column)
  const decodedParameterName = yield* decodeParameterName(parameterName)

  return withParameters(`${decodedColumn} = :${decodedParameterName}`, {
    [decodedParameterName]: value
  })
})

export const soqlIn = Effect.fn("Soda3.soqlIn")(function* (
  column: unknown,
  parameterBaseName: unknown,
  values: ReadonlyArray<unknown>
) {
  const decodedColumn = yield* decodeIdentifier(column)
  const decodedParameterBaseName = yield* decodeParameterName(parameterBaseName)

  if (values.length === 0) {
    return yield* invalidQueryInput("SoQL IN predicates require at least one value")
  }

  const parameters: Record<string, unknown> = {}
  const placeholders: Array<string> = []

  for (let index = 0; index < values.length; index += 1) {
    const parameterName = `${decodedParameterBaseName}_${index + 1}`
    parameters[parameterName] = values[index]
    placeholders.push(`:${parameterName}`)
  }

  return withParameters(`${decodedColumn} IN (${placeholders.join(", ")})`, parameters)
})

export const soqlIsNotNull = Effect.fn("Soda3.soqlIsNotNull")(function* (column: unknown) {
  const decodedColumn = yield* decodeIdentifier(column)
  return withoutParameters(`${decodedColumn} IS NOT NULL`)
})

export const soqlAnd = Effect.fn("Soda3.soqlAnd")(function* (
  fragments: ReadonlyArray<SoqlFragment>
) {
  if (fragments.length === 0) {
    return yield* invalidQueryInput("SoQL AND composition requires at least one fragment")
  }

  const parameters = yield* mergeParameters(fragments)
  const text = fragments.map((fragment) => `(${fragment.text})`).join(" AND ")

  return parameters === undefined ? withoutParameters(text) : withParameters(text, parameters)
})

export const soqlOrderBy = Effect.fn("Soda3.soqlOrderBy")(function* (
  column: unknown,
  direction: unknown = "ASC"
) {
  const decodedColumn = yield* decodeIdentifier(column)
  const decodedDirection = yield* decodeSortDirection(direction)
  return withoutParameters(`ORDER BY ${decodedColumn} ${decodedDirection}`)
})

export const socrataTimestamp = Effect.fn("Soda3.socrataTimestamp")(function* (
  date: string | Date
) {
  if (date instanceof Date) {
    return yield* utcTimestampFromDate(date)
  }

  const decodedDate = yield* decodeIsoDate(date)
  const parts = yield* dateParts(decodedDate)
  return timestampFromParts(parts.year, parts.month, parts.day)
})

export const socrataMonthWindow = Effect.fn("Soda3.socrataMonthWindow")(function* (
  year: unknown,
  month: unknown
) {
  const decodedYear = yield* decodeYear(year)
  const decodedMonth = yield* decodeMonth(month)
  const endYear = decodedMonth === 12 ? decodedYear + 1 : decodedYear
  const endMonth = decodedMonth === 12 ? 1 : decodedMonth + 1

  return {
    start: timestampFromParts(decodedYear, decodedMonth, 1),
    end: timestampFromParts(endYear, endMonth, 1)
  }
})

export const socrataDateWindow = Effect.fn("Soda3.socrataDateWindow")(function* (
  startDate: unknown,
  endDate: unknown
) {
  const decodedStartDate = yield* decodeIsoDate(startDate)
  const decodedEndDate = yield* decodeIsoDate(endDate)
  const startEpochDay = yield* epochDay(decodedStartDate)
  const endEpochDay = yield* epochDay(decodedEndDate)

  if (startEpochDay >= endEpochDay) {
    return yield* invalidQueryInput("Socrata date windows require startDate before endDate")
  }

  return {
    start: yield* socrataTimestamp(decodedStartDate),
    end: yield* socrataTimestamp(decodedEndDate)
  }
})

export const soqlTimestampRange = Effect.fn("Soda3.soqlTimestampRange")(function* (
  column: unknown,
  startParameterName: unknown,
  endParameterName: unknown,
  window: SocrataTimestampWindow
) {
  const decodedColumn = yield* decodeIdentifier(column)
  const decodedStartParameterName = yield* decodeParameterName(startParameterName)
  const decodedEndParameterName = yield* decodeParameterName(endParameterName)

  if (decodedStartParameterName === decodedEndParameterName) {
    return yield* invalidQueryInput(`Duplicate SoQL parameter name: ${decodedStartParameterName}`)
  }

  return withParameters(
    `${decodedColumn} >= :${decodedStartParameterName} AND ${decodedColumn} < :${decodedEndParameterName}`,
    {
      [decodedStartParameterName]: window.start,
      [decodedEndParameterName]: window.end
    }
  )
})

export const soqlMonthWindow = Effect.fn("Soda3.soqlMonthWindow")(function* (
  column: unknown,
  year: unknown,
  month: unknown,
  parameterBaseName: unknown
) {
  const decodedParameterBaseName = yield* decodeParameterName(parameterBaseName)
  const window = yield* socrataMonthWindow(year, month)
  return yield* soqlTimestampRange(
    column,
    `${decodedParameterBaseName}_start`,
    `${decodedParameterBaseName}_end`,
    window
  )
})

export const soqlYearMonthRange = Effect.fn("Soda3.soqlYearMonthRange")(function* (
  yearColumn: unknown,
  monthColumn: unknown,
  start: unknown,
  end: unknown
) {
  const decodedYearColumn = yield* decodeIdentifier(yearColumn)
  const decodedMonthColumn = yield* decodeIdentifier(monthColumn)
  const decodedStart = yield* decodeYearMonth(start)
  const decodedEnd = yield* decodeYearMonth(end)
  const startOrder = decodedStart.year * 12 + decodedStart.month
  const endOrder = decodedEnd.year * 12 + decodedEnd.month

  if (startOrder > endOrder) {
    return yield* invalidQueryInput("SoQL year/month ranges require start before end")
  }

  return withParameters(
    `(${decodedYearColumn} > :start_year OR (${decodedYearColumn} = :start_year AND ${decodedMonthColumn} >= :start_month)) AND (${decodedYearColumn} < :end_year OR (${decodedYearColumn} = :end_year AND ${decodedMonthColumn} <= :end_month))`,
    {
      start_year: decodedStart.year,
      start_month: decodedStart.month,
      end_year: decodedEnd.year,
      end_month: decodedEnd.month
    }
  )
})
