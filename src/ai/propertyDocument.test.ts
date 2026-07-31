import { describe, expect, it } from 'vitest'
import { defaultProperty } from '../properties/propertyProfiles'
import {
  applyExtraction, extractionFieldKeys, recommendedExtractionFields,
  type PropertyDocumentExtraction,
} from './propertyDocument'

function extractionWith(values: Partial<PropertyDocumentExtraction['fields']>): PropertyDocumentExtraction {
  return {
    documentType: 'mixed',
    fields: Object.fromEntries(extractionFieldKeys.map(key => [
      key,
      values[key] ?? {
        value: null, confidence: 0, evidence: null, imageIndex: null, conflict: false,
      },
    ])) as PropertyDocumentExtraction['fields'],
    warnings: [],
  }
}

describe('property document calibration', () => {
  it('does not preselect low-confidence or conflicting fields', () => {
    const extraction = extractionWith({
      address: { value: '台北市信義路 1 號', confidence: 0.95, evidence: '建物標示', imageIndex: 1, conflict: false },
      purchasePrice: { value: 15_000_000, confidence: 0.95, evidence: '總價不同', imageIndex: 2, conflict: true },
    })
    expect(recommendedExtractionFields(extraction)).toEqual(['address'])
  })

  it('applies only fields explicitly confirmed by the user', () => {
    const extraction = extractionWith({
      address: { value: '新地址', confidence: 0.98, evidence: '地址欄', imageIndex: 1, conflict: false },
      purchasePrice: { value: 15_000_000, confidence: 0.97, evidence: '買賣總價', imageIndex: 1, conflict: false },
      deedTax: { value: 88_000, confidence: 0.93, evidence: '契稅金額', imageIndex: 2, conflict: false },
    })
    const result = applyExtraction(defaultProperty, extraction, ['address', 'deedTax'])
    expect(result.address).toBe('新地址')
    expect(result.acquisitionCosts.deedTax).toBe(88_000)
    expect(result.purchasePrice).toBe(defaultProperty.purchasePrice)
    expect(defaultProperty.acquisitionCosts.deedTax).toBe(0)
  })
})

