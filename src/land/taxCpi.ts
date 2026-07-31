export const OFFICIAL_CPI_SERIES_ENDPOINT = import.meta.env.DEV
  ? "/api/cpi-series"
  : "https://nstatdb.dgbas.gov.tw/dgbasAll/webMain.aspx?sdmx/A030101015/"

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>

export type TaxCpiResult = {
  adjustmentPercent: number
  baseYearMonth: string
  referenceYearMonth: string
  provider: string
}

type CpiObservation = {
  yearMonth: string
  value: number
}

// The official table defines the tax index as:
// latest CPI / CPI of the previous-transfer month × 100, rounded to 1 decimal.
// This small verified snapshot keeps the saved demo property usable when the
// government API is temporarily unavailable. Online data remains preferred.
const OFFICIAL_CPI_FALLBACK: CpiObservation[] = [
  { yearMonth: "2021-02", value: 99.28 },
  { yearMonth: "2026-06", value: 112.03 },
]

function normalizeYearMonth(value: string): string {
  const match = value.match(/(\d{4})\D*M?(\d{1,2})/)
  if (!match) return ""
  return `${match[1]}-${match[2].padStart(2, "0")}`
}

function findObservationPeriods(value: unknown): string[] {
  if (Array.isArray(value)) {
    const periods = value
      .map(item => {
        if (!item || typeof item !== "object") return ""
        const record = item as Record<string, unknown>
        return normalizeYearMonth(String(record.id ?? record.name ?? ""))
      })
      .filter(Boolean)
    if (periods.length > 1) return periods
    for (const child of value) {
      const found = findObservationPeriods(child)
      if (found.length) return found
    }
    return []
  }
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  if ("observation" in record) {
    const found = findObservationPeriods(record.observation)
    if (found.length) return found
  }
  for (const child of Object.values(record)) {
    const found = findObservationPeriods(child)
    if (found.length) return found
  }
  return []
}

function findObservationMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (
    record.observations &&
    typeof record.observations === "object" &&
    !Array.isArray(record.observations)
  ) return record.observations as Record<string, unknown>
  for (const child of Object.values(record)) {
    const found = findObservationMap(child)
    if (found) return found
  }
  return null
}

export function parseOfficialCpiJson(payload: unknown): CpiObservation[] {
  const periods = findObservationPeriods(payload)
  const observations = findObservationMap(payload)
  if (!periods.length || !observations) {
    throw new Error("官方物價資料格式無法解析")
  }
  const result = Object.entries(observations).flatMap(([index, rawValue]) => {
    const value = Number(Array.isArray(rawValue) ? rawValue[0] : rawValue)
    const yearMonth = periods[Number(index)] ?? ""
    return yearMonth && Number.isFinite(value) ? [{ yearMonth, value }] : []
  })
  if (!result.length) throw new Error("官方資料未包含消費者物價總指數")
  return result.sort((left, right) =>
    left.yearMonth.localeCompare(right.yearMonth)
  )
}

export function calculateTaxCpi(
  observations: CpiObservation[],
  baseYearMonth: string,
  requestedReferenceYearMonth: string,
): TaxCpiResult {
  if (!/^\d{4}-\d{2}$/.test(baseYearMonth)) {
    throw new Error("請先設定正確的前次移轉年月")
  }
  const base = observations.find(item => item.yearMonth === baseYearMonth)
  if (!base) throw new Error(`官方資料查無 ${baseYearMonth} 的物價指數`)
  const available = observations.filter(
    item => !requestedReferenceYearMonth ||
      item.yearMonth <= requestedReferenceYearMonth,
  )
  const reference = available.at(-1)
  if (!reference) throw new Error("官方資料尚無可用的本次移轉月份")
  return {
    adjustmentPercent: Math.round((reference.value / base.value) * 1_000) / 10,
    baseYearMonth,
    referenceYearMonth: reference.yearMonth,
    provider: "行政院主計總處總體統計資料庫",
  }
}

export async function fetchTaxCpi(
  baseYearMonth: string,
  requestedReferenceYearMonth: string,
  fetcher: FetchLike = fetch,
): Promise<TaxCpiResult> {
  try {
    const response = await fetcher(OFFICIAL_CPI_SERIES_ENDPOINT, {
      headers: { Accept: "application/json" },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return calculateTaxCpi(
      parseOfficialCpiJson(await response.json()),
      baseYearMonth,
      requestedReferenceYearMonth,
    )
  } catch {
    const fallback = calculateTaxCpi(
      OFFICIAL_CPI_FALLBACK,
      baseYearMonth,
      requestedReferenceYearMonth,
    )
    return {
      ...fallback,
      provider: "行政院主計總處稅務專用物價指數表（內建官方資料快照）",
    }
  }
}
