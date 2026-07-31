import { describe, expect, it, vi } from "vitest"
import {
  extractLandNumber,
  fetchOfficialLandValue,
  fetchOfficialSectionCode,
  inferCityCode,
  normalizeLandNumber,
} from "./officialLandValue"

describe("official land value lookup", () => {
  it("normalizes parent and child land numbers to the official 8-digit form", () => {
    expect(normalizeLandNumber("427-13 地號")).toBe("04270013")
    expect(normalizeLandNumber("427")).toBe("04270000")
  })

  it("extracts the land number from a complete cadastral identifier", () => {
    expect(extractLandNumber("新北市板橋區新板段三小段0025-0000"))
      .toBe("0025-0000")
    expect(extractLandNumber("新北市板橋區新板段三小段25地號"))
      .toBe("0025-0000")
  })

  it("infers the county or city code from a complete identifier", () => {
    expect(inferCityCode("新北市板橋區新板段三小段0025-0000")).toBe("F")
    expect(inferCityCode("台北市中正區某段1地號")).toBe("A")
  })

  it("finds the official section code by the complete cadastral identifier", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{
        CITY: "新北市",
        TOWN: "板橋區",
        Section: "新板段",
        SubSection: "三小段",
        SectionCode: "0123",
      }],
    }))

    await expect(fetchOfficialSectionCode(
      "新北市板橋區新板段三小段0025-0000",
      "",
      fetcher,
    )).resolves.toBe("0123")
  })

  it("does not guess a section code when the official list has no match", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }))

    await expect(fetchOfficialSectionCode(
      "新北市板橋區新板段三小段0025-0000",
      "F",
      fetcher,
    )).rejects.toThrow("查無對應段小段代碼")
  })

  it("finds and maps a matching official record", async () => {
    const requestedUrls: string[] = []
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      requestedUrls.push(String(request))
      return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{
          LANDNO: "04270013",
          LANDPRICE: "32000",
          CURRENTVALUE: "88000",
          OWNER: "某市政府",
        }],
      }),
      }
    })

    await expect(fetchOfficialLandValue(
      "F",
      "12",
      "427-13",
      fetcher,
    )).resolves.toEqual({
      landNumber: "04270013",
      announcedLandPrice: 32_000,
      announcedCurrentValue: 88_000,
      provider: "某市政府",
    })
    expect(requestedUrls[0]).toContain("CITY=F")
    expect(requestedUrls[0]).toContain("SEC=0012")
  })

  it("reports a missing parcel without inventing a value", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    }))

    await expect(fetchOfficialLandValue(
      "F",
      "0012",
      "427-13",
      fetcher,
    )).rejects.toThrow("查無此地號")
  })
})
