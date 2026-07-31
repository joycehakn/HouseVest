import { describe, expect, it } from "vitest"
import {
  annualizedMonthlyIrr,
  calculateHoldingPeriod,
  calculatePropertyAnalysis,
  mortgagePayment,
  type PropertyInputs,
} from "./propertyAnalysis"

const inputs: PropertyInputs = {
  purchasePrice: 14_100_000,
  acquisitionCosts: 230_867,
  originalLoan: 11_980_000,
  currentLoanBalance: 10_485_197,
  mortgageDataDate: "2026-08-01",
  mortgagePaymentDay: 15,
  totalMortgagePaymentsPaid: 2_721_992,
  mortgagePaymentMode: "actual",
  paymentEstimateAnnualRate: 2.18,
  originalLoanTermYears: 30,
  annualRate: 2.18,
  remainingLoanYears: 25,
  salePrice: 17_500_000,
  sellingAgencyFeeRate: 4,
  otherSellingCosts: 0,
  documentedOtherSellingCosts: 0,
  taxProfile: {
    residency: "resident",
    sellingExpenseMethod: "documented",
    priorThreeYearTransactionLoss: 0,
    landPriceIncrementTotal: 0,
    landValueIncrementTax: 0,
    deductibleLandValueIncrementTax: 0,
    claimsSelfUseBenefit: false,
    householdRegistrationDate: null,
    householdRegisteredAndLivedSixYears: false,
    noRentalOrBusinessUseSixYears: false,
    noSelfUseBenefitInPriorSixYears: false,
    involuntaryTransferEligible: false,
    claimsRepurchaseBenefit: false,
    repurchaseDate: null,
    repurchasePrice: null,
    oldAndNewHomesRegisteredAndOccupied: false,
    oldHomeNoRentalOrBusinessOneYear: false,
    acknowledgesFiveYearClawback: false,
    claimsLandValueRepurchaseRefund: false,
    repurchasedLandDeclaredValue: null,
    soldLandDeclaredValue: null,
    sameLandOwner: false,
    landPriceIncrementParcels: [],
  },
  purchaseDate: "2021-08-01",
  saleDate: "2026-08-01",
}

describe("calculateHoldingPeriod", () => {
  it("calculates days, payment months, and fractional years from dates", () => {
    expect(calculateHoldingPeriod("2021-08-01", "2026-08-01")).toEqual({
      days: 1_826,
      months: 60,
      years: 1_826 / 365.2425,
    })
  })

  it("rejects a sale date that is not after the purchase date", () => {
    expect(() =>
      calculateHoldingPeriod("2026-08-01", "2026-08-01"),
    ).toThrow("saleDate must be later than purchaseDate")
  })
})

describe("mortgage calculations", () => {
  it("calculates a future payment from the current balance and assumptions", () => {
    expect(mortgagePayment(10_485_197, 2.18, 25)).toBeCloseTo(45_366.52, 2)
  })

  it("can estimate cumulative payments from the amortized monthly payment", () => {
    const result = calculatePropertyAnalysis({
      ...inputs,
      mortgagePaymentMode: "estimated",
      paymentEstimateAnnualRate: 2,
      originalLoanTermYears: 30,
    })
    const expectedMonthlyPayment = mortgagePayment(
      inputs.originalLoan,
      2,
      30,
    )

    expect(result.mortgagePaymentMode).toBe("estimated")
    expect(result.averageHistoricalMonthlyPayment).toBeCloseTo(
      expectedMonthlyPayment,
      6,
    )
    expect(result.totalMortgagePayments).toBeCloseTo(
      expectedMonthlyPayment * result.paidMonths,
      6,
    )
  })

  it("adds projected payments from the mortgage data date to the sale date", () => {
    const result = calculatePropertyAnalysis({
      ...inputs,
      mortgageDataDate: "2025-08-01",
      saleDate: "2026-08-01",
    })

    expect(result.historicalMortgagePayments).toBe(
      inputs.totalMortgagePaymentsPaid,
    )
    expect(result.futurePaymentMonths).toBe(12)
    expect(result.futureMortgagePayments).toBeCloseTo(
      result.futureMonthlyPayment * 12,
      6,
    )
    expect(result.totalMortgagePayments).toBeCloseTo(
      result.historicalMortgagePayments + result.futureMortgagePayments,
      6,
    )
  })

  it("counts only actual payment dates after the balance date", () => {
    expect(calculatePropertyAnalysis({
      ...inputs,
      mortgageDataDate: "2026-07-31",
      mortgagePaymentDay: 15,
      saleDate: "2026-08-01",
    }).futurePaymentMonths).toBe(0)

    expect(calculatePropertyAnalysis({
      ...inputs,
      mortgageDataDate: "2026-07-31",
      mortgagePaymentDay: 1,
      saleDate: "2026-08-01",
    }).futurePaymentMonths).toBe(1)
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
    expect(result.taxAnalysis.appliedRate).toBe(35)
    expect(result.tax).toBeCloseTo(864_196.55, 1)
    expect(result.netCash).toBeCloseTo(
      inputs.salePrice - result.saleCosts - result.tax - result.balance,
      6,
    )
    expect(result.profit).toBeCloseTo(
      result.netCash - result.initialEquity - result.totalMortgagePayments,
      6,
    )
  })

  it("adds percentage agency fees and fixed selling costs transparently", () => {
    const result = calculatePropertyAnalysis({
      ...inputs,
      sellingAgencyFeeRate: 2,
      otherSellingCosts: 120_000,
    })

    expect(result.sellingAgencyFee).toBe(350_000)
    expect(result.otherSellingCosts).toBe(120_000)
    expect(result.saleCosts).toBe(470_000)
  })

  it("uses the user-entered balance instead of deriving it from interest", () => {
    const result = calculatePropertyAnalysis({
      ...inputs,
      currentLoanBalance: 9_876_543,
      annualRate: 9.99,
    })

    expect(result.balance).toBe(9_876_543)
    expect(result.netCash).toBeCloseTo(
      inputs.salePrice - result.saleCosts - result.tax - 9_876_543,
      6,
    )
  })
})
