import type { PropertyAnalysis } from '../calculations/propertyAnalysis'
import type { PropertyProfile } from '../properties/propertyProfiles'

export const VALIDATION_CASE_KEY = 'housevest.validation-case-a.v1'

export type ValidationScenario = {
  salePrice: number
  sellingAgencyFeeRate: number
  customSellingCosts: { id: string; name: string; amount: number; documented: boolean }[]
  saleDate: string
}

export type ValidationStatus = 'confirmed' | 'estimated' | 'pending'
export type ValidationField = 'purchasePrice' | 'salePrice' | 'tax' | 'profit' | 'cagr' | 'leveragedIrr'
export type ValidationFieldStatuses = Record<ValidationField, ValidationStatus>

export const defaultValidationFieldStatuses: ValidationFieldStatuses = {
  purchasePrice: 'confirmed',
  salePrice: 'estimated',
  tax: 'pending',
  profit: 'pending',
  cagr: 'pending',
  leveragedIrr: 'pending',
}

export type ValidationCase = {
  id: 'case-a'
  name: '案例 A'
  createdAt: string
  source: '目前已儲存資料'
  property: PropertyProfile
  scenario: ValidationScenario
  result: Pick<PropertyAnalysis, 'tax' | 'profit' | 'netCash' | 'cagr' | 'leveragedIrr'>
  fieldStatuses: ValidationFieldStatuses
}

export function createValidationCase(
  property: PropertyProfile,
  scenario: ValidationScenario,
  result: PropertyAnalysis,
  createdAt = new Date().toISOString(),
): ValidationCase {
  return {
    id: 'case-a',
    name: '案例 A',
    createdAt,
    source: '目前已儲存資料',
    property: structuredClone(property),
    scenario: structuredClone(scenario),
    result: {
      tax: result.tax,
      profit: result.profit,
      netCash: result.netCash,
      cagr: result.cagr,
      leveragedIrr: result.leveragedIrr,
    },
    fieldStatuses: {
      ...defaultValidationFieldStatuses,
      tax: result.taxAnalysis.complete ? 'estimated' : 'pending',
      profit: result.taxAnalysis.complete ? 'estimated' : 'pending',
      cagr: result.taxAnalysis.complete ? 'estimated' : 'pending',
      leveragedIrr: result.taxAnalysis.complete ? 'estimated' : 'pending',
    },
  }
}

export function loadValidationCase(storage: Pick<Storage, 'getItem'>): ValidationCase | null {
  try {
    const saved = storage.getItem(VALIDATION_CASE_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as Partial<ValidationCase>
    return parsed.id === 'case-a' && parsed.property && parsed.scenario && parsed.result
      ? {
          ...parsed,
          fieldStatuses: {
            ...defaultValidationFieldStatuses,
            ...(parsed.fieldStatuses ?? {}),
          },
        } as ValidationCase
      : null
  } catch {
    return null
  }
}

export function saveValidationCase(
  storage: Pick<Storage, 'setItem'>,
  validationCase: ValidationCase,
): void {
  storage.setItem(VALIDATION_CASE_KEY, JSON.stringify(validationCase))
}
