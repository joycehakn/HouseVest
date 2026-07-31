import {
  calculatePropertyAnalysis,
  type PropertyAnalysis,
  type PropertyInputs,
} from '../calculations/propertyAnalysis'

export const dateScenarioSteps = [
  { months: 0, label: '基準日' },
  { months: 6, label: '半年後' },
  { months: 12, label: '1 年後' },
  { months: 24, label: '2 年後' },
  { months: 36, label: '3 年後' },
] as const

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
  months: number
  label: string
  saleDate: string
  result: PropertyAnalysis
}

export function createDateScenarioComparisons(
  inputs: PropertyInputs,
): DateScenarioComparison[] {
  return dateScenarioSteps.map(item => {
    const saleDate = addMonths(inputs.saleDate, item.months)
    return {
      ...item,
      saleDate,
      result: calculatePropertyAnalysis({ ...inputs, saleDate }),
    }
  })
}
