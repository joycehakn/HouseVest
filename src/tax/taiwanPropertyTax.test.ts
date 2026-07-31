import { describe, expect, it } from "vitest"
import {
  calculateTaiwanPropertyTax,
  determineStandardRate,
  determineTaxRegime,
  type TaiwanPropertyTaxInput,
} from "./taiwanPropertyTax"

const input: TaiwanPropertyTaxInput = {
  purchaseDate: "2021-08-01",
  saleDate: "2026-08-01",
  salePrice: 17_500_000,
  purchasePrice: 14_100_000,
  acquisitionCosts: 200_000,
  documentedSellingExpenses: 700_000,
  profile: {
    residency: "resident",
    sellingExpenseMethod: "documented",
    priorThreeYearTransactionLoss: 0,
    landPriceIncrementTotal: 500_000,
    landValueIncrementTax: 100_000,
    deductibleLandValueIncrementTax: 0,
    claimsSelfUseBenefit: false,
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
  },
}

describe("Taiwan property tax", () => {
  it("determines legacy, integrated 1.0 and integrated 2.0 regimes", () => {
    expect(determineTaxRegime("2015-12-31", "2026-01-01")).toBe("legacy")
    expect(determineTaxRegime("2016-01-01", "2021-06-30")).toBe("integrated-1")
    expect(determineTaxRegime("2016-01-01", "2021-07-01")).toBe("integrated-2")
  })

  it("uses integrated 2.0 resident holding-period rates", () => {
    expect(determineStandardRate("integrated-2", "resident", 365).rate).toBe(45)
    expect(determineStandardRate("integrated-2", "resident", 365 * 3).rate).toBe(35)
    expect(determineStandardRate("integrated-2", "resident", 365 * 7).rate).toBe(20)
    expect(determineStandardRate("integrated-2", "resident", 365 * 11).rate).toBe(15)
  })

  it("calculates transaction income, taxable income and total tax", () => {
    const result = calculateTaiwanPropertyTax(input)

    expect(result.transactionIncome).toBe(2_500_000)
    expect(result.taxableIncome).toBe(2_000_000)
    expect(result.appliedRate).toBe(35)
    expect(result.houseLandIncomeTax).toBe(700_000)
    expect(result.totalTax).toBe(800_000)
  })

  it("automatically uses the statutory 3% expense when it is higher", () => {
    const result = calculateTaiwanPropertyTax({
      ...input,
      salePrice: 20_000_000,
      documentedSellingExpenses: 100_000,
    })

    expect(result.recognizedSellingExpenses).toBe(300_000)
    expect(result.recognizedSellingExpenseMethod).toBe("statutory")
  })

  it("automatically uses documented expenses when they are higher", () => {
    const result = calculateTaiwanPropertyTax(input)

    expect(result.recognizedSellingExpenses).toBe(700_000)
    expect(result.recognizedSellingExpenseMethod).toBe("documented")
  })

  it("applies the self-use exemption and 10% rate only when every condition is met", () => {
    const result = calculateTaiwanPropertyTax({
      ...input,
      purchaseDate: "2018-01-01",
      saleDate: "2026-01-02",
      salePrice: 21_500_000,
      profile: {
        ...input.profile,
        claimsSelfUseBenefit: true,
        householdRegisteredAndLivedSixYears: true,
        noRentalOrBusinessUseSixYears: true,
        noSelfUseBenefitInPriorSixYears: true,
      },
    })

    expect(result.selfUseQualified).toBe(true)
    expect(result.selfUseExemption).toBe(4_000_000)
    expect(result.taxableIncome).toBe(6_000_000)
    expect(result.houseLandIncomeTax).toBe(200_000)
  })

  it("does not invent a separated tax result for legacy transactions", () => {
    const result = calculateTaiwanPropertyTax({
      ...input,
      purchaseDate: "2015-01-01",
    })

    expect(result.regime).toBe("legacy")
    expect(result.houseLandIncomeTax).toBeNull()
    expect(result.complete).toBe(false)
  })

  it("calculates house-land and land-value repurchase refunds separately", () => {
    const result = calculateTaiwanPropertyTax({
      ...input,
      profile: {
        ...input.profile,
        claimsRepurchaseBenefit: true,
        repurchaseDate: "2027-08-01",
        repurchasePrice: 8_750_000,
        oldAndNewHomesRegisteredAndOccupied: true,
        oldHomeNoRentalOrBusinessOneYear: true,
        acknowledgesFiveYearClawback: true,
        claimsLandValueRepurchaseRefund: true,
        repurchasedLandDeclaredValue: 4_500_000,
        soldLandDeclaredValue: 4_500_000,
        sameLandOwner: true,
      },
    })

    expect(result.repurchaseQualified).toBe(true)
    expect(result.houseLandRepurchaseRefund).toBe(350_000)
    expect(result.landValueRepurchaseRefund).toBe(100_000)
    expect(result.totalRepurchaseRefund).toBe(450_000)
    expect(result.netTaxAfterRefund).toBe(350_000)
  })
})
