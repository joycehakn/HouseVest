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

const dayAfter = (date: string): string => {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

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
  const sixYearDate = addYears(inputs.purchaseDate, 6)
  const tenYearRateDate = dayAfter(addYears(inputs.purchaseDate, 10))
  const halfYearDate = addMonths(inputs.saleDate, 6)
  const threeYearDate = addMonths(inputs.saleDate, 36)
  const steps = [
    { key: 'base', months: 0, label: '基準日', adjustment: '基準出售日', saleDate: inputs.saleDate },
    sixYearDate > halfYearDate
      ? { key: 'six-years', months: 6, label: '持有滿 6 年', adjustment: '自住優惠年限門檻', saleDate: sixYearDate }
      : { key: 'six-months', months: 6, label: '半年後', adjustment: '基準日後 6 個月', saleDate: halfYearDate },
    { key: 'one-year', months: 12, label: '1 年後', adjustment: '基準日後 12 個月', saleDate: addMonths(inputs.saleDate, 12) },
    { key: 'two-years', months: 24, label: '2 年後', adjustment: '基準日後 24 個月', saleDate: addMonths(inputs.saleDate, 24) },
    tenYearRateDate > threeYearDate
      ? { key: 'over-ten-years', months: 36, label: '持有超過 10 年', adjustment: '15% 一般稅率門檻', saleDate: tenYearRateDate }
      : { key: 'three-years', months: 36, label: '3 年後', adjustment: '基準日後 36 個月', saleDate: threeYearDate },
  ]

  return steps.map(item => {
    const saleDate = item.saleDate
    return {
      ...item,
      result: calculatePropertyAnalysis({ ...inputs, saleDate }),
    }
  })
}
