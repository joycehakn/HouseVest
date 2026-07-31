import type { PropertyProfile } from '../properties/propertyProfiles'

export const extractionFieldKeys = [
  'address', 'purchaseDate', 'purchasePrice', 'deedTax', 'stampTax',
  'registrationFees', 'agencyFee', 'legalFee', 'otherCosts', 'originalLoan',
  'currentLoanBalance', 'totalMortgagePaymentsPaid', 'annualRate',
  'remainingLoanYears',
] as const

export type ExtractionFieldKey = typeof extractionFieldKeys[number]
export type ExtractedField = {
  value: string | number | null
  confidence: number
  evidence: string | null
  imageIndex: number | null
  conflict: boolean
}
export type PropertyDocumentExtraction = {
  documentType: 'purchase_contract' | 'tax_receipt' | 'mortgage_statement' | 'mixed' | 'other'
  fields: Record<ExtractionFieldKey, ExtractedField>
  warnings: string[]
}

export const extractionFieldLabels: Record<ExtractionFieldKey, string> = {
  address: '地址',
  purchaseDate: '購入成交日',
  purchasePrice: '購入價格',
  deedTax: '契稅',
  stampTax: '印花稅',
  registrationFees: '登記與規費',
  agencyFee: '購入仲介費',
  legalFee: '代書費',
  otherCosts: '其他取得成本',
  originalLoan: '原始貸款金額',
  currentLoanBalance: '目前銀行貸款餘額',
  totalMortgagePaymentsPaid: '累積房貸付款',
  annualRate: '目前房貸利率',
  remainingLoanYears: '剩餘貸款年限',
}

export function availableExtractionFields(extraction: PropertyDocumentExtraction) {
  return extractionFieldKeys.filter(key => extraction.fields[key].value !== null)
}

export function recommendedExtractionFields(extraction: PropertyDocumentExtraction) {
  return availableExtractionFields(extraction).filter(key => {
    const field = extraction.fields[key]
    return field.confidence >= 0.8 && !field.conflict
  })
}

export function applyExtraction(
  profile: PropertyProfile,
  extraction: PropertyDocumentExtraction,
  selected: readonly ExtractionFieldKey[],
): PropertyProfile {
  const next = { ...profile, acquisitionCosts: { ...profile.acquisitionCosts } }
  for (const key of selected) {
    const value = extraction.fields[key].value
    if (value === null) continue
    if (key === 'address' || key === 'purchaseDate') {
      if (typeof value === 'string') next[key] = value
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue
    if (key === 'otherCosts') {
      const existing = next.customAcquisitionCosts.find(cost => cost.name === 'OCR 辨識其他費用')
      next.customAcquisitionCosts = existing
        ? next.customAcquisitionCosts.map(cost =>
            cost.id === existing.id ? { ...cost, amount: value } : cost)
        : [...next.customAcquisitionCosts, {
            id: crypto.randomUUID(),
            name: 'OCR 辨識其他費用',
            amount: value,
          }]
    } else if (['deedTax', 'stampTax', 'registrationFees', 'agencyFee', 'legalFee'].includes(key)) {
      next.acquisitionCosts[key as keyof PropertyProfile['acquisitionCosts']] = value
    } else {
      next[key as 'purchasePrice'] = value
    }
  }
  return next
}
