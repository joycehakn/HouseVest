import { describe, expect, it, vi } from "vitest"
import {
  fetchOfficialLandValue,
  normalizeLandNumber,
} from "./officialLandValue"

describe("official land value lookup", () => {
  it("normalizes parent and child land numbers to the official 8-digit form", () => {
    expect(normalizeLandNumber("427-13 地號")).toBe("04270013")
    expect(normalizeLandNumber("427")).toBe("04270000")
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
