export type PropertyInputs = {
  purchasePrice: number
  acquisitionCosts: number
  originalLoan: number
  annualRate: number
  loanYears: number
  salePrice: number
  saleCostsRate: number
  taxRate: number
  holdingYears: number
}

export type PropertyAnalysis = {
  totalCost: number
  monthlyPayment: number
  paidMonths: number
  totalMortgagePayments: number
  balance: number
  saleCosts: number
  taxableGain: number
  tax: number
  netSaleBeforeLoan: number
  netCash: number
  initialEquity: number
  profit: number
  cagr: number
  leveragedIrr: number
  equity: number
  score: number
}

export function mortgagePayment(
  principal: number,
  annualRatePercent: number,
  years: number,
): number {
  const monthlyRate = annualRatePercent / 100 / 12
  const months = years * 12

  if (monthlyRate === 0) return principal / months

  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  )
}

export function mortgageBalance(
  principal: number,
  annualRatePercent: number,
  years: number,
  paidYears: number,
): number {
  const monthlyRate = annualRatePercent / 100 / 12
  const months = years * 12
  const paidMonths = Math.min(Math.round(paidYears * 12), months)

  if (monthlyRate === 0) {
    return Math.max(0, principal * (1 - paidMonths / months))
  }

  const payment = mortgagePayment(principal, annualRatePercent, years)
  return Math.max(
    0,
    principal * Math.pow(1 + monthlyRate, paidMonths) -
      (payment * (Math.pow(1 + monthlyRate, paidMonths) - 1)) / monthlyRate,
  )
}

function npv(rate: number, cashFlows: number[]): number {
  return cashFlows.reduce(
    (value, cashFlow, period) =>
      value + cashFlow / Math.pow(1 + rate, period),
    0,
  )
}

export function annualizedMonthlyIrr(cashFlows: number[]): number {
  let low = -0.9999
  let high = 1
  let lowNpv = npv(low, cashFlows)
  let highNpv = npv(high, cashFlows)

  if (lowNpv === 0) return -100

  while (lowNpv * highNpv > 0 && high < 1_024) {
    high *= 2
    highNpv = npv(high, cashFlows)
  }

  if (lowNpv * highNpv > 0) return Number.NaN

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const middle = (low + high) / 2
    const middleNpv = npv(middle, cashFlows)

    if (Math.abs(middleNpv) < 0.000001) {
      return (Math.pow(1 + middle, 12) - 1) * 100
    }

    if (lowNpv * middleNpv <= 0) {
      high = middle
    } else {
      low = middle
      lowNpv = middleNpv
    }
  }

  const monthlyRate = (low + high) / 2
  return (Math.pow(1 + monthlyRate, 12) - 1) * 100
}

export function calculatePropertyAnalysis(
  inputs: PropertyInputs,
): PropertyAnalysis {
  const totalCost = inputs.purchasePrice + inputs.acquisitionCosts
  const paidMonths = Math.min(
    Math.round(inputs.holdingYears * 12),
    inputs.loanYears * 12,
  )
  const monthlyPayment = mortgagePayment(
    inputs.originalLoan,
    inputs.annualRate,
    inputs.loanYears,
  )
  const totalMortgagePayments = monthlyPayment * paidMonths
  const balance = mortgageBalance(
    inputs.originalLoan,
    inputs.annualRate,
    inputs.loanYears,
    inputs.holdingYears,
  )
  const saleCosts = (inputs.salePrice * inputs.saleCostsRate) / 100
  const taxableGain = Math.max(
    0,
    inputs.salePrice - totalCost - saleCosts,
  )
  const tax = (taxableGain * inputs.taxRate) / 100
  const netSaleBeforeLoan = inputs.salePrice - saleCosts - tax
  const netCash = netSaleBeforeLoan - balance
  const initialEquity = totalCost - inputs.originalLoan
  const profit = netCash - initialEquity - totalMortgagePayments
  const cagr =
    (Math.pow(netSaleBeforeLoan / totalCost, 1 / inputs.holdingYears) - 1) *
    100

  const cashFlows = [
    -initialEquity,
    ...Array.from({ length: paidMonths }, (_, index) =>
      index === paidMonths - 1
        ? netCash - monthlyPayment
        : -monthlyPayment,
    ),
  ]
  const leveragedIrr = annualizedMonthlyIrr(cashFlows)
  const equity = inputs.salePrice - balance
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(55 + cagr * 4 + leveragedIrr * 1.8 - inputs.annualRate * 2),
    ),
  )

  return {
    totalCost,
    monthlyPayment,
    paidMonths,
    totalMortgagePayments,
    balance,
    saleCosts,
    taxableGain,
    tax,
    netSaleBeforeLoan,
    netCash,
    initialEquity,
    profit,
    cagr,
    leveragedIrr,
    equity,
    score,
  }
}
