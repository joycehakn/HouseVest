export type TaxResidency = "resident" | "nonresident"
export type SellingExpenseMethod = "documented" | "statutory"

export type TaiwanPropertyTaxProfile = {
  residency: TaxResidency
  sellingExpenseMethod: SellingExpenseMethod
  priorThreeYearTransactionLoss: number
  landPriceIncrementTotal: number | null
  landValueIncrementTax: number | null
  deductibleLandValueIncrementTax: number
  claimsSelfUseBenefit: boolean
  householdRegisteredAndLivedSixYears: boolean
  noRentalOrBusinessUseSixYears: boolean
  noSelfUseBenefitInPriorSixYears: boolean
  involuntaryTransferEligible: boolean
}

export type TaiwanPropertyTaxInput = {
  purchaseDate: string
  saleDate: string
  salePrice: number
  purchasePrice: number
  acquisitionCosts: number
  documentedSellingExpenses: number
  profile: TaiwanPropertyTaxProfile
}

export type TaiwanPropertyTaxResult = {
  regime: "legacy" | "integrated-1" | "integrated-2"
  regimeLabel: string
  holdingDays: number
  holdingYears: number
  recognizedSellingExpenses: number
  transactionIncome: number
  taxableIncome: number
  appliedRate: number | null
  rateReason: string
  selfUseQualified: boolean
  selfUseExemption: number
  houseLandIncomeTax: number | null
  landValueIncrementTax: number
  totalTax: number | null
  effectiveTaxRate: number | null
  complete: boolean
  missingData: string[]
  warnings: string[]
}

const DAY = 86_400_000

function utc(value: string): number {
  const [year, month, day] = value.split("-").map(Number)
  return Date.UTC(year, month - 1, day)
}

function atOrAfter(value: string, boundary: string): boolean {
  return utc(value) >= utc(boundary)
}

function holdingDays(purchaseDate: string, saleDate: string): number {
  return Math.max(0, (utc(saleDate) - utc(purchaseDate)) / DAY)
}

export function determineTaxRegime(
  purchaseDate: string,
  saleDate: string,
): TaiwanPropertyTaxResult["regime"] {
  if (!atOrAfter(purchaseDate, "2016-01-01")) return "legacy"
  return atOrAfter(saleDate, "2021-07-01")
    ? "integrated-2"
    : "integrated-1"
}

export function determineStandardRate(
  regime: "integrated-1" | "integrated-2",
  residency: TaxResidency,
  days: number,
): { rate: number; reason: string } {
  const years = days / 365.2425
  if (residency === "nonresident") {
    const shortBoundary = regime === "integrated-2" ? 2 : 1
    return years <= shortBoundary
      ? { rate: 45, reason: `非境內居住者持有未逾 ${shortBoundary} 年` }
      : { rate: 35, reason: `非境內居住者持有超過 ${shortBoundary} 年` }
  }
  if (regime === "integrated-2") {
    if (years <= 2) return { rate: 45, reason: "境內居住者持有未逾 2 年" }
    if (years <= 5) return { rate: 35, reason: "境內居住者持有超過 2 年、未逾 5 年" }
    if (years <= 10) return { rate: 20, reason: "境內居住者持有超過 5 年、未逾 10 年" }
    return { rate: 15, reason: "境內居住者持有超過 10 年" }
  }
  if (years <= 1) return { rate: 45, reason: "境內居住者持有未逾 1 年" }
  if (years <= 2) return { rate: 35, reason: "境內居住者持有超過 1 年、未逾 2 年" }
  if (years <= 10) return { rate: 20, reason: "境內居住者持有超過 2 年、未逾 10 年" }
  return { rate: 15, reason: "境內居住者持有超過 10 年" }
}

export function calculateTaiwanPropertyTax(
  input: TaiwanPropertyTaxInput,
): TaiwanPropertyTaxResult {
  const regime = determineTaxRegime(input.purchaseDate, input.saleDate)
  const days = holdingDays(input.purchaseDate, input.saleDate)
  const years = days / 365.2425
  const statutoryExpenses = Math.min(input.salePrice * 0.03, 300_000)
  const recognizedSellingExpenses =
    input.profile.sellingExpenseMethod === "documented"
      ? input.documentedSellingExpenses
      : statutoryExpenses
  const transactionIncome = Math.max(
    0,
    input.salePrice -
      input.purchasePrice -
      input.acquisitionCosts -
      recognizedSellingExpenses -
      input.profile.deductibleLandValueIncrementTax,
  )
  const taxableIncome = Math.max(
    0,
    transactionIncome -
      input.profile.priorThreeYearTransactionLoss -
      (input.profile.landPriceIncrementTotal ?? 0),
  )
  const selfUseQualified =
    input.profile.claimsSelfUseBenefit &&
    input.profile.residency === "resident" &&
    years >= 6 &&
    input.profile.householdRegisteredAndLivedSixYears &&
    input.profile.noRentalOrBusinessUseSixYears &&
    input.profile.noSelfUseBenefitInPriorSixYears
  const missingData: string[] = []
  const warnings: string[] = []

  if (regime === "legacy") {
    missingData.push("舊制房屋評定現值與土地、房屋成交價拆分資料")
    warnings.push("本引擎目前不替舊制案件推算綜合所得稅；應依出售年度與所在地標準另行計算。")
    return {
      regime,
      regimeLabel: "舊制財產交易所得",
      holdingDays: days,
      holdingYears: years,
      recognizedSellingExpenses,
      transactionIncome,
      taxableIncome,
      appliedRate: null,
      rateReason: "舊制案件不適用房地合一分離稅率",
      selfUseQualified: false,
      selfUseExemption: 0,
      houseLandIncomeTax: null,
      landValueIncrementTax: input.profile.landValueIncrementTax ?? 0,
      totalTax: null,
      effectiveTaxRate: null,
      complete: false,
      missingData,
      warnings,
    }
  }

  if (input.profile.landPriceIncrementTotal === null) {
    missingData.push("土地漲價總數額")
  }
  if (input.profile.landValueIncrementTax === null) {
    missingData.push("土地增值稅核定或試算金額")
  }
  if (
    input.profile.claimsSelfUseBenefit &&
    !selfUseQualified
  ) {
    warnings.push("已勾選申請自住房地優惠，但目前條件未全部符合，改按一般稅率計算。")
  }

  let appliedRate: number
  let rateReason: string
  let selfUseExemption = 0
  let houseLandIncomeTax: number
  if (selfUseQualified) {
    selfUseExemption = Math.min(taxableIncome, 4_000_000)
    appliedRate = 10
    rateReason = "符合自住房地優惠：課稅所得 400 萬元內免稅，超過部分 10%"
    houseLandIncomeTax = Math.max(0, taxableIncome - selfUseExemption) * 0.1
  } else if (input.profile.involuntaryTransferEligible && years <= 5) {
    appliedRate = 20
    rateReason = "使用者確認符合財政部公告非自願性交易且持有未逾 5 年"
    houseLandIncomeTax = taxableIncome * 0.2
    warnings.push("非自願性交易資格應備妥證明並由稽徵機關認定。")
  } else {
    const standard = determineStandardRate(regime, input.profile.residency, days)
    appliedRate = standard.rate
    rateReason = standard.reason
    houseLandIncomeTax = taxableIncome * appliedRate / 100
  }
  const landValueIncrementTax = input.profile.landValueIncrementTax ?? 0
  const totalTax = houseLandIncomeTax + landValueIncrementTax

  return {
    regime,
    regimeLabel: regime === "integrated-2" ? "房地合一稅 2.0" : "房地合一稅 1.0",
    holdingDays: days,
    holdingYears: years,
    recognizedSellingExpenses,
    transactionIncome,
    taxableIncome,
    appliedRate,
    rateReason,
    selfUseQualified,
    selfUseExemption,
    houseLandIncomeTax,
    landValueIncrementTax,
    totalTax,
    effectiveTaxRate:
      transactionIncome > 0 ? totalTax / transactionIncome * 100 : 0,
    complete: missingData.length === 0,
    missingData,
    warnings,
  }
}
