import { describe, expect, it } from 'vitest'
import { calculatePropertyAnalysis } from '../calculations/propertyAnalysis'
import { defaultProperty, totalAcquisitionCosts } from '../properties/propertyProfiles'
import { createValidationCase, loadValidationCase, saveValidationCase } from './validationCase'

describe('validation case A', () => {
  it('freezes and restores the current inputs and outputs', () => {
    const scenario = { salePrice: 17_500_000, sellingAgencyFeeRate: 4, customSellingCosts: [], saleDate: '2026-08-01' }
    const result = calculatePropertyAnalysis({
      ...defaultProperty,
      acquisitionCosts: totalAcquisitionCosts(defaultProperty.acquisitionCosts, defaultProperty.customAcquisitionCosts),
      otherSellingCosts: 0,
      documentedOtherSellingCosts: 0,
      salePrice: scenario.salePrice,
      sellingAgencyFeeRate: scenario.sellingAgencyFeeRate,
      saleDate: scenario.saleDate,
    })
    const validationCase = createValidationCase(defaultProperty, scenario, result, '2026-07-31T12:00:00.000Z')
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }

    saveValidationCase(storage, validationCase)

    expect(loadValidationCase(storage)).toEqual(validationCase)
    expect(validationCase.property).not.toBe(defaultProperty)
  })
})
