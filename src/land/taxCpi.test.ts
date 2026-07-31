import { describe, expect, it, vi } from "vitest"
import { calculateTaxCpi, fetchTaxCpi, parseOfficialCpiJson } from "./taxCpi"

const payload = {
  data: {
    series: {
      "0": {
        observations: {
          "0": [98.2],
          "1": [108.6],
          "2": [108.9],
        },
      },
    },
  },
  structure: {
    dimensions: {
      observation: [{
        values: [
          { id: "2021-M2", name: "110年2月" },
          { id: "2026-M5", name: "115年5月" },
          { id: "2026-M6", name: "115年6月" },
        ],
      }],
    },
  },
}

describe("tax CPI lookup", () => {
  it("parses monthly overall CPI observations", () => {
    expect(parseOfficialCpiJson(payload)).toEqual([
      { yearMonth: "2021-02", value: 98.2 },
      { yearMonth: "2026-05", value: 108.6 },
      { yearMonth: "2026-06", value: 108.9 },
    ])
  })

  it("uses the latest published month not later than the sale month", () => {
    expect(calculateTaxCpi(
      parseOfficialCpiJson(payload),
      "2021-02",
      "2026-08",
    )).toMatchObject({
      adjustmentPercent: 110.9,
      referenceYearMonth: "2026-06",
    })
  })

  it("fetches and calculates the official adjustment", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    }))
    await expect(fetchTaxCpi("2021-02", "2026-08", fetcher))
      .resolves.toMatchObject({ adjustmentPercent: 110.9 })
  })

  it("uses the verified official snapshot when the service is unavailable", async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => ({}),
    }))
    await expect(fetchTaxCpi("2021-02", "2026-08", fetcher))
      .resolves.toMatchObject({
        adjustmentPercent: 112.8,
        referenceYearMonth: "2026-06",
        provider: expect.stringContaining("內建官方資料快照"),
      })
  })
})
