import type { PropertyAnalysis } from '../calculations/propertyAnalysis'
import type { PropertyProfile } from '../properties/propertyProfiles'

export const VALIDATION_CASE_KEY = 'housevest.validation-case-a.v1'

export type ValidationScenario = {
  salePrice: number
  sellingAgencyFeeRate: number
  customSellingCosts: { id: string; name: string; amount: number; documented: boolean }[]
  saleDate: string
}

export type ValidationCase = {
  id: 'case-a'
  name: '案例 A'
  createdAt: string
  source: '目前已儲存資料'
  property: PropertyProfile
  scenario: ValidationScenario
  result: Pick<PropertyAnalysis, 'tax' | 'profit' | 'netCash' | 'cagr' | 'leveragedIrr'>
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
  }
}

export function loadValidationCase(storage: Pick<Storage, 'getItem'>): ValidationCase | null {
  try {
    const saved = storage.getItem(VALIDATION_CASE_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as Partial<ValidationCase>
    return parsed.id === 'case-a' && parsed.property && parsed.scenario && parsed.result
      ? parsed as ValidationCase
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
