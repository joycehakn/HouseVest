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
): DateScenarioComparison[] {
  const steps = [
    { key: 'base', months: 0, label: '基準日', adjustment: '基準出售日', saleDate: inputs.saleDate },
    { key: 'six-months', months: 6, label: '基準日＋半年', adjustment: '基準日後 6 個月', saleDate: addMonths(inputs.saleDate, 6) },
    { key: 'one-year', months: 12, label: '基準日＋1年', adjustment: '基準日後 12 個月', saleDate: addMonths(inputs.saleDate, 12) },
    { key: 'two-years', months: 24, label: '基準日＋2年', adjustment: '基準日後 24 個月', saleDate: addMonths(inputs.saleDate, 24) },
  ]

  return steps.map(item => {
    const saleDate = item.saleDate
    return {
      ...item,
      result: calculatePropertyAnalysis({ ...inputs, saleDate }),
    }
  })
}
