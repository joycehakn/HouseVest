export type AcquisitionCosts = {
  deedTax: number
  stampTax: number
  registrationFees: number
  agencyFee: number
  legalFee: number
  otherCosts: number
}

export type PropertyProfile = {
  id: string
  name: string
  address: string
  purchaseDate: string
  purchasePrice: number
  acquisitionCosts: AcquisitionCosts
  originalLoan: number
  currentLoanBalance: number
  totalMortgagePaymentsPaid: number
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
    otherCosts: 230_867,
  },
  originalLoan: 11_980_000,
  currentLoanBalance: 10_485_197,
  totalMortgagePaymentsPaid: 2_721_992,
  annualRate: 2.18,
  remainingLoanYears: 25,
  currentMarketValue: 17_500_000,
}

export function totalAcquisitionCosts(costs: AcquisitionCosts): number {
  return Object.values(costs).reduce((total, cost) => total + cost, 0)
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

export function loadPropertyDatabase(
  storage: Pick<Storage, "getItem">,
): PropertyDatabase {
  try {
    const saved = storage.getItem(PROPERTY_DATABASE_KEY)
    if (!saved) return createDefaultDatabase()
    const parsed: unknown = JSON.parse(saved)
    return isPropertyDatabase(parsed) ? parsed : createDefaultDatabase()
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
