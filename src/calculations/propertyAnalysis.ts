export type PropertyInputs = {
  purchasePrice: number
  acquisitionCosts: number
  originalLoan: number
  currentLoanBalance: number
  mortgageDataDate: string
  totalMortgagePaymentsPaid: number
  mortgagePaymentMode: "actual" | "estimated"
  paymentEstimateAnnualRate: number
  originalLoanTermYears: number
  annualRate: number
  remainingLoanYears: number
  salePrice: number
  sellingAgencyFeeRate: number
  otherSellingCosts: number
  taxProfile: TaiwanPropertyTaxProfile
  purchaseDate: string
  saleDate: string
}

export type PropertyAnalysis = {
  holdingDays: number
  holdingYears: number
  totalCost: number
  averageHistoricalMonthlyPayment: number
  futureMonthlyPayment: number
  paidMonths: number
  historicalPaidMonths: number
  futurePaymentMonths: number
  historicalMortgagePayments: number
  futureMortgagePayments: number
  totalMortgagePayments: number
  mortgagePaymentMode: "actual" | "estimated"
  balance: number
  sellingAgencyFee: number
  otherSellingCosts: number
  saleCosts: number
  taxableGain: number
  tax: number
  taxAnalysis: TaiwanPropertyTaxResult
  netSaleBeforeLoan: number
  netCash: number
  initialEquity: number
  profit: number
  cagr: number
  leveragedIrr: number
  equity: number
  score: number
}

function parseIsoDate(value: string): number {
  const [year, month, day] = value.split("-").map(Number)
  return Date.UTC(year, month - 1, day)
}

export function calculateHoldingPeriod(
  purchaseDate: string,
  saleDate: string,
): { days: number; months: number; years: number } {
  const milliseconds = parseIsoDate(saleDate) - parseIsoDate(purchaseDate)

  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new Error("saleDate must be later than purchaseDate")
  }

  const days = milliseconds / 86_400_000
  return {
    days,
    months: Math.max(1, Math.round(days / 30.436875)),
    years: days / 365.2425,
  }
}

function monthsBetweenOrZero(startDate: string, endDate: string): number {
  const milliseconds = parseIsoDate(endDate) - parseIsoDate(startDate)
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 0
  return Math.max(1, Math.round(milliseconds / 86_400_000 / 30.436875))
}

export function mortgagePayment(
  principal: number,
  annualRatePercent: number,
  years: number,
): number {
  if (principal <= 0 || years <= 0) return 0
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
  const holdingPeriod = calculateHoldingPeriod(
    inputs.purchaseDate,
    inputs.saleDate,
  )
  const totalCost = inputs.purchasePrice + inputs.acquisitionCosts
  const paidMonths = holdingPeriod.months
  const historicalPaidMonths = monthsBetweenOrZero(
    inputs.purchaseDate,
    inputs.mortgageDataDate,
  )
  const estimatedMonthlyPayment = mortgagePayment(
    inputs.originalLoan,
    inputs.paymentEstimateAnnualRate,
    inputs.originalLoanTermYears,
  )
  const estimatedHistoricalMortgagePayments =
    estimatedMonthlyPayment * historicalPaidMonths
  const historicalMortgagePayments = inputs.mortgagePaymentMode === "actual"
    ? inputs.totalMortgagePaymentsPaid
    : estimatedHistoricalMortgagePayments
  const averageHistoricalMonthlyPayment =
    historicalPaidMonths > 0
      ? historicalMortgagePayments / historicalPaidMonths
      : 0
  const futureMonthlyPayment = mortgagePayment(
    inputs.currentLoanBalance,
    inputs.annualRate,
    inputs.remainingLoanYears,
  )
  const futurePaymentMonths = monthsBetweenOrZero(
    inputs.mortgageDataDate,
    inputs.saleDate,
  )
  const futureMortgagePayments = futureMonthlyPayment * futurePaymentMonths
  const totalMortgagePayments =
    historicalMortgagePayments + futureMortgagePayments
  const balance = inputs.currentLoanBalance
  const sellingAgencyFee =
    (inputs.salePrice * inputs.sellingAgencyFeeRate) / 100
  const otherSellingCosts = inputs.otherSellingCosts
  const saleCosts = sellingAgencyFee + otherSellingCosts
  const taxAnalysis = calculateTaiwanPropertyTax({
    purchaseDate: inputs.purchaseDate,
    saleDate: inputs.saleDate,
    salePrice: inputs.salePrice,
    purchasePrice: inputs.purchasePrice,
    acquisitionCosts: inputs.acquisitionCosts,
    documentedSellingExpenses: saleCosts,
    profile: inputs.taxProfile,
  })
  const taxableGain = taxAnalysis.taxableIncome
  const tax = taxAnalysis.totalTax ?? 0
  const netSaleBeforeLoan = inputs.salePrice - saleCosts - tax
  const netCash = netSaleBeforeLoan - balance
  const initialEquity = totalCost - inputs.originalLoan
  const profit = netCash - initialEquity - totalMortgagePayments
  const cagr =
    (Math.pow(netSaleBeforeLoan / totalCost, 1 / holdingPeriod.years) - 1) *
    100

  const historicalCashFlows = Array.from(
    { length: historicalPaidMonths },
    () => -averageHistoricalMonthlyPayment,
  )
  const untrackedMonths = Math.max(
    0,
    paidMonths - historicalPaidMonths - futurePaymentMonths,
  )
  const futureCashFlows = Array.from(
    { length: futurePaymentMonths },
    (_, index) => index === futurePaymentMonths - 1
      ? netCash - futureMonthlyPayment
      : -futureMonthlyPayment,
  )
  const cashFlows = [
    -initialEquity,
    ...historicalCashFlows,
    ...Array.from({ length: untrackedMonths }, () => 0),
    ...futureCashFlows,
  ]
  if (futurePaymentMonths === 0) cashFlows[cashFlows.length - 1] += netCash
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
    holdingDays: holdingPeriod.days,
    holdingYears: holdingPeriod.years,
    totalCost,
    averageHistoricalMonthlyPayment,
    futureMonthlyPayment,
    paidMonths,
    historicalPaidMonths,
    futurePaymentMonths,
    historicalMortgagePayments,
    futureMortgagePayments,
    totalMortgagePayments,
    mortgagePaymentMode: inputs.mortgagePaymentMode,
    balance,
    sellingAgencyFee,
    otherSellingCosts,
    saleCosts,
    taxableGain,
    tax,
    taxAnalysis,
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
import {
  calculateTaiwanPropertyTax,
  type TaiwanPropertyTaxProfile,
  type TaiwanPropertyTaxResult,
} from "../tax/taiwanPropertyTax"
