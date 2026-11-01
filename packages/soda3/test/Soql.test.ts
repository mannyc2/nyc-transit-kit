import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Statement from "effect/sql/Statement"
import { IsoDate } from "../src/Socrata"
import * as Soql from "../src/Soql"

const text = (fragment: Soql.Fragment) => Soql.compile(fragment)

describe("compile", () => {
  it.effect("writes values as literals and columns as quoted names", () =>
    Effect.gen(function* () {
      expect(yield* text(Soql.eq("borough", "Queens"))).toBe("`borough` = 'Queens'")
      expect(yield* text(Soql.eq("speed", 58.4))).toBe("`speed` = 58.4")
      expect(yield* text(Soql.eq("active", true))).toBe("`active` = true")
      // `from` is a SoQL keyword, and a column of Traffic Volume Counts.
      expect(yield* text(Soql.eq("from", "7 AVE"))).toBe("`from` = '7 AVE'")
    })
  )

  it.effect("doubles a quote inside a string, the only escape SoQL has", () =>
    Effect.gen(function* () {
      expect(yield* text(Soql.eq("link_name", "O'BRIEN'S WAY"))).toBe(
        "`link_name` = 'O''BRIEN''S WAY'"
      )
    })
  )

  it.effect.prop("no string can end its literal early", [Schema.String], ([value]) =>
    Effect.gen(function* () {
      const soql = yield* text(Soql.eq("c", value))
      const literal = soql.slice("`c` = '".length, -1)
      expect(literal.replaceAll("''", "")).not.toContain("'")
      expect(literal.replaceAll("''", "'")).toBe(value)
    })
  )

  it.effect("refuses a column SoQL cannot name and a value it cannot write", () =>
    Effect.gen(function* () {
      const backtick = yield* Effect.flip(text(Soql.eq("bad`name", 1)))
      expect(backtick).toMatchObject({ _tag: "SoqlError" })
      const nan = yield* Effect.flip(text(Soql.eq("speed", Number.NaN)))
      expect(nan.message).toBe("SoQL has no literal for NaN")
      const emptyIn = yield* Effect.flip(text(Soql.soql`x IN ${Statement.arrayHelper([])}`))
      expect(emptyIn.message).toBe("SoQL IN needs at least one value")
    })
  )

  it.effect("splices fragments into a template", () =>
    Effect.gen(function* () {
      const where = Soql.isIn("boro", ["QNS", "BK"])
      expect(
        yield* text(Soql.soql`SELECT count(*) WHERE ${where} AND ${Soql.isNotNull("hours")}`)
      ).toBe("SELECT count(*) WHERE `boro` IN ('QNS','BK') AND `hours` IS NOT NULL")
    })
  )
})

describe("clauses", () => {
  it.effect("AND and OR keep each clause in its own parentheses", () =>
    Effect.gen(function* () {
      const either = Soql.or([Soql.eq("b", 2), Soql.eq("c", 3)])
      expect(yield* text(Soql.and([Soql.eq("a", 1), either]))).toBe(
        "(`a` = 1) AND ((`b` = 2) OR (`c` = 3))"
      )
    })
  )

  it.effect("SELECT * carries each clause that is given, in SoQL's order", () =>
    Effect.gen(function* () {
      expect(yield* text(Soql.selectAll({}))).toBe("SELECT *")
      expect(
        yield* text(
          Soql.selectAll({
            where: Soql.eq("borough", "Staten Island"),
            orderBy: { column: "data_as_of", direction: "DESC" },
            limit: 2
          })
        )
      ).toBe("SELECT * WHERE `borough` = 'Staten Island' ORDER BY `data_as_of` DESC LIMIT 2")
    })
  )
})

describe("time windows", () => {
  it("December's window ends at the next January", () => {
    expect(Soql.monthWindow({ year: 2026, month: 12 })).toEqual({
      start: "2026-12-01T00:00:00",
      end: "2027-01-01T00:00:00"
    })
  })

  it.effect("a month range is half open", () =>
    Effect.gen(function* () {
      expect(yield* text(Soql.monthRange("data_as_of", { year: 2026, month: 10 }))).toBe(
        "`data_as_of` >= '2026-10-01T00:00:00' AND `data_as_of` < '2026-11-01T00:00:00'"
      )
    })
  )

  it.effect("a date window runs up to its end and refuses to be empty", () =>
    Effect.gen(function* () {
      const day = (value: string) => IsoDate.make(value)
      expect(yield* Soql.dateWindow(day("2026-10-01"), day("2026-10-02"))).toEqual({
        start: "2026-10-01T00:00:00",
        end: "2026-10-02T00:00:00"
      })
      const empty = yield* Effect.flip(Soql.dateWindow(day("2026-10-02"), day("2026-10-02")))
      expect(empty.message).toBe("Date window 2026-10-02..2026-10-02 is empty")
    })
  )

  it.effect("a year/month range includes both end months and refuses a reversed range", () =>
    Effect.gen(function* () {
      const columns = { year: "year", month: "month" }
      const range = yield* Soql.yearMonthRange(
        columns,
        { year: 2025, month: 11 },
        { year: 2026, month: 2 }
      )
      expect(yield* text(range)).toBe(
        "(`year` > 2025 OR (`year` = 2025 AND `month` >= 11)) AND (`year` < 2026 OR (`year` = 2026 AND `month` <= 2))"
      )
      const reversed = yield* Effect.flip(
        Soql.yearMonthRange(columns, { year: 2026, month: 2 }, { year: 2025, month: 11 })
      )
      expect(reversed._tag).toBe("SoqlError")
    })
  )
})
