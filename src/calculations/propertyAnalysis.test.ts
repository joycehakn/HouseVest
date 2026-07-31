import { describe, expect, it } from "vitest"
import {
  annualizedMonthlyIrr,
  calculatePropertyAnalysis,
  mortgageBalance,
  mortgagePayment,
  type PropertyInputs,
} from "./propertyAnalysis"

const inputs: PropertyInputs = {
  purchasePrice: 14_100_000,
  acquisitionCosts: 230_867,
  originalLoan: 11_980_000,
  annualRate: 2.18,
  loanYears: 30,
  salePrice: 17_500_000,
  saleCostsRate: 4,
  taxRate: 20,
  holdingYears: 5,
}

describe("mortgage calculations", () => {
  it("calculates the fixed monthly payment and remaining balance", () => {
    expect(mortgagePayment(11_980_000, 2.18, 30)).toBeCloseTo(45_366.53, 2)
    expect(mortgageBalance(11_980_000, 2.18, 30, 5)).toBeCloseTo(
      10_485_197.45,
      2,
    )
  })
})

describe("annualizedMonthlyIrr", () => {
  it("returns 12% when monthly cash flows compound to a 12% annual return", () => {
    const monthlyRate = Math.pow(1.12, 1 / 12) - 1
    expect(
      annualizedMonthlyIrr([
        -1_000,
        ...Array.from({ length: 11 }, () => 0),
        1_000 * Math.pow(1 + monthlyRate, 12),
      ]),
    ).toBeCloseTo(12, 6)
  })
})

describe("calculatePropertyAnalysis", () => {
  it("reconciles sale proceeds and profit from their component values", () => {
    const result = calculatePropertyAnalysis(inputs)

    expect(result.saleCosts).toBe(700_000)
    expect(result.taxableGain).toBe(2_469_133)
    expect(result.tax).toBeCloseTo(493_826.6, 1)
    expect(result.netCash).toBeCloseTo(
      inputs.salePrice - result.saleCosts - result.tax - result.balance,
      6,
    )
    expect(result.profit).toBeCloseTo(
      result.netCash - result.initialEquity - result.totalMortgagePayments,
      6,
    )
  })
})
