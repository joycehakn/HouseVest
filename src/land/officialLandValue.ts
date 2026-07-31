export type OfficialLandValueRecord = {
  landNumber: string
  announcedLandPrice: number
  announcedCurrentValue: number
  provider: string
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>

export const OFFICIAL_LAND_VALUE_ENDPOINT =
  "https://openapi.moi.gov.tw/WEBAPI/LandPrice/Lastest"

export function normalizeLandNumber(value: string): string {
  const cleaned = value.trim().replace(/地號/g, "")
  const continuousDigits = cleaned.replace(/\D/g, "")
  if (!cleaned.includes("-") && continuousDigits.length === 8) {
    return continuousDigits
  }
  const [parent = "", child = ""] = cleaned.split("-")
  const normalizedParent = parent.replace(/\D/g, "").padStart(4, "0")
  const normalizedChild = child.replace(/\D/g, "").padStart(4, "0")
  return `${normalizedParent}${normalizedChild}`.slice(-8)
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(collectRecords)
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  const self = "LANDNO" in record ? [record] : []
  return [
    ...self,
    ...Object.values(record).flatMap(collectRecords),
  ]
}

export async function fetchOfficialLandValue(
  cityCode: string,
  sectionCode: string,
  landNumber: string,
  fetcher: FetchLike = fetch,
): Promise<OfficialLandValueRecord> {
  const city = cityCode.trim().toUpperCase()
  const section = sectionCode.trim().padStart(4, "0")
  if (!/\d/.test(landNumber)) throw new Error("請輸入正確地號")
  const normalizedLandNumber = normalizeLandNumber(landNumber)
  if (!/^[A-Z]$/.test(city)) throw new Error("請選擇縣市")
  if (!/^\d{4}$/.test(section)) throw new Error("段小段代碼必須是4碼")
  if (!/^\d{8}$/.test(normalizedLandNumber)) throw new Error("請輸入正確地號")

  const url = new URL(OFFICIAL_LAND_VALUE_ENDPOINT)
  url.searchParams.set("CITY", city)
  url.searchParams.set("SEC", section)
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`官方資料服務回應錯誤（${response.status}）`)
  const payload = await response.json()
  const match = collectRecords(payload).find(record =>
    normalizeLandNumber(String(record.LANDNO ?? "")) === normalizedLandNumber
  )
  if (!match) throw new Error("查無此地號，請確認縣市、段小段代碼與地號")
  const announcedCurrentValue = Number(match.CURRENTVALUE)
  if (!Number.isFinite(announcedCurrentValue)) {
    throw new Error("官方資料缺少公告土地現值")
  }
  return {
    landNumber: normalizedLandNumber,
    announcedLandPrice: Number(match.LANDPRICE) || 0,
    announcedCurrentValue,
    provider: [
      match.PROVIDER,
      match.OWNER,
      match.OWNERSECTION,
    ].filter(Boolean).map(String).join("・") || "內政部地政資料",
  }
}
