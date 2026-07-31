import {
  calculatePropertyAnalysis,
  type PropertyAnalysis,
  type PropertyInputs,
} from '../calculations/propertyAnalysis'

export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

export const addYears = (date: string, years: number): string =>
  addMonths(date, years * 12)

export type DateScenarioComparison = {
  key: string
  months: number
  label: string
  adjustment: string
  saleDate: string
  result: PropertyAnalysis
}

export function createDateScenarioComparisons(
  inputs: PropertyInputs,
  stepMonths = 6,
): DateScenarioComparison[] {
  const safeStep = Math.max(1, Math.round(stepMonths))
  const formatStepLabel = (months: number) => months === 6
    ? '半年'
    : months % 12 === 0
      ? `${months / 12}年`
      : `${months}個月`
  const steps = [
    { key: 'base', months: 0, label: '基準日', adjustment: '基準出售日', saleDate: inputs.saleDate },
    { key: 'step-1', months: safeStep, label: `基準日＋${formatStepLabel(safeStep)}`, adjustment: `基準日後 ${safeStep} 個月`, saleDate: addMonths(inputs.saleDate, safeStep) },
    { key: 'step-2', months: safeStep * 2, label: `基準日＋${formatStepLabel(safeStep * 2)}`, adjustment: `基準日後 ${safeStep * 2} 個月`, saleDate: addMonths(inputs.saleDate, safeStep * 2) },
    { key: 'step-4', months: safeStep * 4, label: `基準日＋${formatStepLabel(safeStep * 4)}`, adjustment: `基準日後 ${safeStep * 4} 個月`, saleDate: addMonths(inputs.saleDate, safeStep * 4) },
  ]

  return steps.map(item => {
    const saleDate = item.saleDate
    return {
      ...item,
      result: calculatePropertyAnalysis({ ...inputs, saleDate }),
    }
  })
}
