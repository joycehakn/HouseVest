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
      }, [
        { id: "custom-1", name: "履約保證費", amount: 3_000 },
        { id: "custom-2", name: "貸款設定費", amount: 2_000 },
      ]),
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

  it("migrates the previous otherCosts value into a custom line item", () => {
    const legacy = createDefaultDatabase()
    const property = legacy.properties[0] as unknown as {
      acquisitionCosts: Record<string, number>
      customAcquisitionCosts?: unknown
    }
    property.acquisitionCosts.otherCosts = 12_345
    delete property.customAcquisitionCosts
    const storage = { getItem: () => JSON.stringify(legacy) }

    const loaded = loadPropertyDatabase(storage)

    expect(loaded.properties[0].customAcquisitionCosts).toEqual([{
      id: "property-a-legacy-other-cost",
      name: "其他取得成本（舊資料）",
      amount: 12_345,
    }])
  })
})
