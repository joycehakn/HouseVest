import { describe, expect, it } from "vitest"
import {
  PROPERTY_DATABASE_KEY,
  createDefaultDatabase,
  loadPropertyDatabase,
  savePropertyDatabase,
  totalAcquisitionCosts,
} from "./propertyProfiles"

describe("property profiles", () => {
  it("adds all acquisition cost categories", () => {
    expect(
      totalAcquisitionCosts({
        deedTax: 100_000,
        stampTax: 10_000,
        registrationFees: 20_000,
        agencyFee: 300_000,
        legalFee: 30_000,
        otherCosts: 5_000,
      }),
    ).toBe(465_000)
  })

  it("persists and reloads the property database", () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    }
    const database = createDefaultDatabase()

    savePropertyDatabase(storage, database)

    expect(data.has(PROPERTY_DATABASE_KEY)).toBe(true)
    expect(loadPropertyDatabase(storage)).toEqual(database)
  })

  it("falls back to the default property when saved data is invalid", () => {
    const storage = { getItem: () => "{not-json" }
    expect(loadPropertyDatabase(storage)).toEqual(createDefaultDatabase())
  })
})
