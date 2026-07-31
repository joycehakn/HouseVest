export const fieldKeys = [
  'address', 'purchaseDate', 'purchasePrice', 'deedTax', 'stampTax',
  'registrationFees', 'agencyFee', 'legalFee', 'otherCosts', 'originalLoan',
  'currentLoanBalance', 'totalMortgagePaymentsPaid', 'annualRate',
  'remainingLoanYears',
]

const field = {
  type: 'object',
  additionalProperties: false,
  properties: {
    value: { type: ['string', 'number', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    evidence: { type: ['string', 'null'] },
    imageIndex: { type: ['integer', 'null'] },
    conflict: { type: 'boolean' },
  },
  required: ['value', 'confidence', 'evidence', 'imageIndex', 'conflict'],
}

export const propertyExtractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    documentType: {
      type: 'string',
      enum: ['purchase_contract', 'tax_receipt', 'mortgage_statement', 'mixed', 'other'],
    },
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(fieldKeys.map(key => [key, field])),
      required: fieldKeys,
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['documentType', 'fields', 'warnings'],
}

export function validateExtraction(data, imageCount) {
  if (!data || typeof data !== 'object') return false
  if (!['purchase_contract', 'tax_receipt', 'mortgage_statement', 'mixed', 'other'].includes(data.documentType)) return false
  if (!data.fields || typeof data.fields !== 'object' || !Array.isArray(data.warnings)) return false
  return fieldKeys.every(key => {
    const item = data.fields[key]
    return item && typeof item === 'object' &&
      (item.value === null || typeof item.value === 'string' || typeof item.value === 'number') &&
      typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1 &&
      (item.evidence === null || typeof item.evidence === 'string') &&
      (item.imageIndex === null || (
        Number.isInteger(item.imageIndex) && item.imageIndex >= 1 && item.imageIndex <= imageCount
      )) &&
      typeof item.conflict === 'boolean'
  })
}

