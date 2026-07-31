import { describe, expect, it } from 'vitest'
import { calculatePropertyAnalysis, type PropertyInputs } from '../calculations/propertyAnalysis'
import { defaultProperty, totalAcquisitionCosts } from '../properties/propertyProfiles'
import { addMonths, createDateScenarioComparisons } from './dateScenarios'

const inputs: PropertyInputs = {
  purchasePrice: defaultProperty.purchasePrice,
  acquisitionCosts: totalAcquisitionCosts(defaultProperty.acquisitionCosts, defaultProperty.customAcquisitionCosts),
  originalLoan: defaultProperty.originalLoan,
  currentLoanBalance: defaultProperty.currentLoanBalance,
  mortgageDataDate: defaultProperty.mortgageDataDate,
  mortgagePaymentDay: defaultProperty.mortgagePaymentDay,
  totalMortgagePaymentsPaid: defaultProperty.totalMortgagePaymentsPaid,
  mortgagePaymentMode: defaultProperty.mortgagePaymentMode,
  paymentEstimateAnnualRate: defaultProperty.paymentEstimateAnnualRate,
  originalLoanTermYears: defaultProperty.originalLoanTermYears,
  annualRate: defaultProperty.annualRate,
  remainingLoanYears: defaultProperty.remainingLoanYears,
  salePrice: defaultProperty.currentMarketValue,
  sellingAgencyFeeRate: 4,
  otherSellingCosts: 0,
  documentedOtherSellingCosts: 0,
  taxProfile: defaultProperty.taxProfile,
  purchaseDate: defaultProperty.purchaseDate,
  saleDate: '2026-08-31',
}

describe('date scenario comparisons', () => {
  it('creates five future sale-date scenarios and recalculates each result', () => {
    const scenarios = createDateScenarioComparisons(inputs)

    expect(scenarios.map(item => item.saleDate)).toEqual([
      '2026-08-31', '2027-08-01', '2027-08-31', '2028-08-31', '2031-08-02',
    ])
    expect(scenarios[0].result).toEqual(calculatePropertyAnalysis(inputs))
    expect(scenarios[4].result.holdingYears).toBeGreaterThan(scenarios[0].result.holdingYears)
    expect(scenarios[0].result.taxAnalysis.appliedRate).toBe(20)
    expect(scenarios[4].result.taxAnalysis.appliedRate).toBe(15)
  })

  it('clamps month-end dates instead of overflowing into the next month', () => {
    expect(addMonths('2024-08-31', 6)).toBe('2025-02-28')
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28')
  })
})
