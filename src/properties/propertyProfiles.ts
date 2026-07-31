export type AcquisitionCosts = {
  deedTax: number
  stampTax: number
  registrationFees: number
  agencyFee: number
  legalFee: number
}

export type CustomAcquisitionCost = {
  id: string
  name: string
  amount: number
}

export type PropertyProfile = {
  id: string
  name: string
  address: string
  purchaseDate: string
  purchasePrice: number
  acquisitionCosts: AcquisitionCosts
  customAcquisitionCosts: CustomAcquisitionCost[]
  originalLoan: number
  currentLoanBalance: number
  mortgageDataDate: string
  mortgagePaymentMode: "actual" | "estimated"
  totalMortgagePaymentsPaid: number
  paymentEstimateAnnualRate: number
  originalLoanTermYears: number
  annualRate: number
  remainingLoanYears: number
  currentMarketValue: number
}

export type PropertyDatabase = {
  activePropertyId: string
  properties: PropertyProfile[]
}

export const PROPERTY_DATABASE_KEY = "housevest.property-database.v1"

export const defaultProperty: PropertyProfile = {
  id: "property-a",
  name: "房子 A",
  address: "板橋新府路",
  purchaseDate: "2021-08-01",
  purchasePrice: 14_100_000,
  acquisitionCosts: {
    deedTax: 0,
    stampTax: 0,
    registrationFees: 0,
    agencyFee: 0,
    legalFee: 0,
  },
  customAcquisitionCosts: [
    { id: "default-other-cost", name: "其他取得成本", amount: 230_867 },
  ],
  originalLoan: 11_980_000,
  currentLoanBalance: 10_485_197,
  mortgageDataDate: "2026-07-31",
  mortgagePaymentMode: "estimated",
  totalMortgagePaymentsPaid: 0,
  paymentEstimateAnnualRate: 2.18,
  originalLoanTermYears: 30,
  annualRate: 2.18,
  remainingLoanYears: 25,
  currentMarketValue: 17_500_000,
}

export function totalAcquisitionCosts(
  costs: AcquisitionCosts,
  customCosts: CustomAcquisitionCost[] = [],
): number {
  return Object.values(costs).reduce((total, cost) => total + cost, 0) +
    customCosts.reduce((total, cost) => total + cost.amount, 0)
}

export function createDefaultDatabase(): PropertyDatabase {
  return {
    activePropertyId: defaultProperty.id,
    properties: [defaultProperty],
  }
}

function isPropertyDatabase(value: unknown): value is PropertyDatabase {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<PropertyDatabase>
  return (
    typeof candidate.activePropertyId === "string" &&
    Array.isArray(candidate.properties) &&
    candidate.properties.length > 0
  )
}

function migrateProperty(profile: PropertyProfile): PropertyProfile {
  const legacyCosts = profile.acquisitionCosts as AcquisitionCosts & {
    otherCosts?: number
  }
  const customCosts = Array.isArray(profile.customAcquisitionCosts)
    ? profile.customAcquisitionCosts
    : legacyCosts.otherCosts
      ? [{
          id: `${profile.id}-legacy-other-cost`,
          name: "其他取得成本（舊資料）",
          amount: legacyCosts.otherCosts,
        }]
      : []
  return {
    ...profile,
    acquisitionCosts: {
      deedTax: Number(legacyCosts.deedTax) || 0,
      stampTax: Number(legacyCosts.stampTax) || 0,
      registrationFees: Number(legacyCosts.registrationFees) || 0,
      agencyFee: Number(legacyCosts.agencyFee) || 0,
      legalFee: Number(legacyCosts.legalFee) || 0,
    },
    customAcquisitionCosts: customCosts,
    mortgageDataDate: profile.mortgageDataDate || new Date().toISOString().slice(0, 10),
    mortgagePaymentMode:
      profile.mortgagePaymentMode === "actual" ||
      profile.mortgagePaymentMode === "estimated"
        ? profile.mortgagePaymentMode
        : profile.id === "property-a" &&
            profile.totalMortgagePaymentsPaid === 2_721_992
          ? "estimated"
          : "actual",
    totalMortgagePaymentsPaid:
      profile.id === "property-a" &&
      profile.totalMortgagePaymentsPaid === 2_721_992
        ? 0
        : Number(profile.totalMortgagePaymentsPaid) || 0,
    paymentEstimateAnnualRate:
      Number(profile.paymentEstimateAnnualRate) || Number(profile.annualRate) || 0,
    originalLoanTermYears: Number(profile.originalLoanTermYears) || 30,
  }
}

export function loadPropertyDatabase(
  storage: Pick<Storage, "getItem">,
): PropertyDatabase {
  try {
    const saved = storage.getItem(PROPERTY_DATABASE_KEY)
    if (!saved) return createDefaultDatabase()
    const parsed: unknown = JSON.parse(saved)
    return isPropertyDatabase(parsed)
      ? { ...parsed, properties: parsed.properties.map(migrateProperty) }
      : createDefaultDatabase()
  } catch {
    return createDefaultDatabase()
  }
}

export function savePropertyDatabase(
  storage: Pick<Storage, "setItem">,
  database: PropertyDatabase,
): void {
  storage.setItem(PROPERTY_DATABASE_KEY, JSON.stringify(database))
}
