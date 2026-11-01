/**
 * SoQL as `effect/sql` fragments.
 *
 * Text written in a `soql` template is trusted SoQL. Every interpolated value
 * becomes a quoted literal and every `identifier` a backticked column, so input
 * can never change the shape of a query. SODA3 has no bind parameters (`:name`
 * names a system column), so `compile` writes the values into the text.
 */
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Statement from "effect/sql/Statement"
import type { IsoDate } from "./Socrata"

export type Fragment = Statement.Fragment

/** A value SoQL can write as a literal. Timestamps are strings such as `2026-10-01T00:00:00`. */
export type Value = string | number | boolean

/** A fragment that cannot be written as SoQL, or clauses that make no sense. */
export class SoqlError extends Schema.TaggedError<SoqlError>()("SoqlError", {
  message: Schema.String
}) {}

/** A column or alias, written as `` `name` `` so that reserved words such as `from` work. */
export const identifier = (name: string): Statement.Identifier => Statement.identifier(name)

/**
 * `` soql`speed > ${limit}` ``. The text is SoQL; each interpolation is a value,
 * an `identifier`, or another fragment spliced in place.
 */
export const soql = (
  strings: TemplateStringsArray,
  ...args: ReadonlyArray<Value | Fragment | Statement.Segment>
): Fragment => {
  const segments: Array<Statement.Segment> = []
  strings.forEach((text, index) => {
    if (text !== "") {
      segments.push(Statement.literal(text))
    }
    if (index < args.length) {
      const arg = args[index]
      if (Statement.isFragment(arg)) {
        segments.push(...arg.segments)
      } else if (typeof arg === "object") {
        segments.push(arg)
      } else if (arg !== undefined) {
        segments.push(Statement.parameter(arg))
      }
    }
  })
  return Statement.fragment(segments)
}

const quote = (text: string) => `'${text.replaceAll("'", "''")}'`

const write = (value: unknown) => (typeof value === "string" ? quote(value) : String(value))

const compiler = Statement.makeCompiler({
  // `Statement` knows no SoQL dialect. The name only matters to dialect switches, which SoQL never uses.
  dialect: "pg",
  placeholder: (_index, value) => write(value),
  onIdentifier: (name) => `\`${name}\``,
  onRecordUpdate: () => ["", []],
  onCustom: () => ["", []]
})

const invalidValue = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value))
    ? undefined
    : `SoQL has no literal for ${String(value)}`

const invalidSegment = (segment: Statement.Segment): string | undefined => {
  switch (segment._tag) {
    case "Literal":
      return undefined
    case "Identifier":
      // SoQL has no escape for a backtick inside a quoted name.
      return segment.value === "" || segment.value.includes("`")
        ? `SoQL cannot name the column ${JSON.stringify(segment.value)}`
        : undefined
    case "Parameter":
      return invalidValue(segment.value)
    case "ArrayHelper":
      return segment.value.length === 0
        ? "SoQL IN needs at least one value"
        : segment.value.map(invalidValue).find((problem) => problem !== undefined)
    default:
      return `SoQL has no ${segment._tag}`
  }
}

/** The SoQL text of a fragment. Fails on a column SoQL cannot name or a value it cannot write. */
export const compile = (fragment: Fragment): Effect.Effect<string, SoqlError> => {
  const problem = fragment.segments.map(invalidSegment).find((message) => message !== undefined)
  return problem === undefined
    ? Effect.succeed(compiler.compile(fragment, false)[0])
    : Effect.fail(new SoqlError({ message: problem }))
}

export const eq = (column: string, value: Value): Fragment => soql`${identifier(column)} = ${value}`

export const isIn = (column: string, values: readonly [Value, ...Array<Value>]): Fragment =>
  soql`${identifier(column)} IN ${Statement.arrayHelper(values)}`

export const isNotNull = (column: string): Fragment => soql`${identifier(column)} IS NOT NULL`

const joinParenthesized =
  (separator: string) =>
  (clauses: readonly [Fragment, ...Array<Fragment>]): Fragment =>
    Statement.join(separator, false)(clauses.map((clause) => soql`(${clause})`))

/** `(a) AND (b)`. Each clause keeps its own parentheses, so an `OR` inside one stays inside it. */
export const and = joinParenthesized(" AND ")

/** `(a) OR (b)`. */
export const or = joinParenthesized(" OR ")

export type SortDirection = "ASC" | "DESC"

export interface OrderBy {
  readonly column: string
  readonly direction?: SortDirection | undefined
}

/** The clauses of a query over whole rows. */
export interface Clauses {
  readonly where?: Fragment | undefined
  readonly orderBy?: OrderBy | undefined
  readonly limit?: number | undefined
}

/** `SELECT *` with each clause that is given, in SoQL's order. */
export const selectAll = ({ where, orderBy, limit }: Clauses): Fragment =>
  Statement.fragment([
    Statement.literal("SELECT *"),
    ...(where === undefined ? [] : [Statement.literal(" WHERE "), ...where.segments]),
    ...(orderBy === undefined
      ? []
      : [
          Statement.literal(" ORDER BY "),
          identifier(orderBy.column),
          Statement.literal(` ${orderBy.direction ?? "ASC"}`)
        ]),
    ...(limit === undefined ? [] : [Statement.literal(" LIMIT "), Statement.parameter(limit)])
  ])

/** A half-open window of Socrata floating timestamps, `start <= t < end`. */
export interface TimestampWindow {
  readonly start: string
  readonly end: string
}

export interface YearMonth {
  readonly year: number
  readonly month: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
}

const monthStart = (year: number, month: number) =>
  `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01T00:00:00`

/** Midnight at the start of a calendar date, as a floating timestamp. */
export const timestamp = (date: IsoDate) => `${date}T00:00:00`

/** The calendar month as a window. */
export const monthWindow = ({ year, month }: YearMonth): TimestampWindow => ({
  start: monthStart(year, month),
  end: month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1)
})

/** The days from `start` up to, not including, `end`. Fails when the window is empty. */
export const dateWindow = (start: IsoDate, end: IsoDate) =>
  start < end
    ? Effect.succeed<TimestampWindow>({ start: timestamp(start), end: timestamp(end) })
    : Effect.fail(new SoqlError({ message: `Date window ${start}..${end} is empty` }))

/** `column` inside the window. */
export const timestampRange = (column: string, window: TimestampWindow): Fragment =>
  soql`${identifier(column)} >= ${window.start} AND ${identifier(column)} < ${window.end}`

/** `column` inside the calendar month. */
export const monthRange = (column: string, month: YearMonth): Fragment =>
  timestampRange(column, monthWindow(month))

/** Rows whose separate year and month columns fall in `[start, end]`, both months included. */
export const yearMonthRange = (
  columns: { readonly year: string; readonly month: string },
  start: YearMonth,
  end: YearMonth
) => {
  if (start.year * 12 + start.month > end.year * 12 + end.month) {
    return Effect.fail(new SoqlError({ message: "Year/month range starts after it ends" }))
  }
  const year = identifier(columns.year)
  const month = identifier(columns.month)
  return Effect.succeed(
    soql`(${year} > ${start.year} OR (${year} = ${start.year} AND ${month} >= ${start.month})) AND (${year} < ${end.year} OR (${year} = ${end.year} AND ${month} <= ${end.month}))`
  )
}
