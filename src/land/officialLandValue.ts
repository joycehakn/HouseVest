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

export const OFFICIAL_LAND_SECTION_ENDPOINT =
  import.meta.env.DEV
    ? "/api/land-sections"
    : "https://lisp.land.moi.gov.tw/MoiMMSv2/SectionList.ashx"

const cityCodes = new Map([
  ["臺北市", "A"], ["新北市", "F"], ["桃園市", "H"], ["臺中市", "B"],
  ["臺南市", "D"], ["高雄市", "E"], ["基隆市", "C"], ["新竹市", "O"],
  ["嘉義市", "I"], ["宜蘭縣", "G"], ["新竹縣", "J"], ["苗栗縣", "K"],
  ["彰化縣", "N"], ["南投縣", "M"], ["雲林縣", "P"], ["嘉義縣", "Q"],
  ["屏東縣", "T"], ["花蓮縣", "U"], ["臺東縣", "V"], ["金門縣", "W"],
  ["澎湖縣", "X"], ["連江縣", "Z"],
])

export function inferCityCode(cadastralIdentifier: string): string {
  const name = normalizeName(cadastralIdentifier)
  const match = [...cityCodes].find(([city]) => name.startsWith(city))
  if (!match) throw new Error("無法從完整地號辨識縣市")
  return match[1]
}

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

export function extractLandNumber(value: string): string {
  const match = value
    .trim()
    .replace(/\s+/g, "")
    .match(/(\d{1,4})(?:-(\d{1,4}))?(?:地號)?$/)
  if (!match) throw new Error("完整地號末端需包含地號，例如0025-0000")
  return `${match[1].padStart(4, "0")}-${(match[2] ?? "0").padStart(4, "0")}`
}

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/台/g, "臺")
}

function recordValue(
  record: Record<string, unknown>,
  key: string,
): unknown {
  const actualKey = Object.keys(record).find(
    candidate => candidate.toLowerCase() === key.toLowerCase(),
  )
  return actualKey ? record[actualKey] : undefined
}

function withSuffix(value: unknown, suffix: string): string {
  const normalized = normalizeName(value)
  return normalized && !normalized.endsWith(suffix)
    ? `${normalized}${suffix}`
    : normalized
}

export async function fetchOfficialSectionCode(
  cadastralIdentifier: string,
  cityCode: string,
  fetcher: FetchLike = fetch,
): Promise<string> {
  const city = cityCode.trim().toUpperCase() ||
    inferCityCode(cadastralIdentifier)
  if (!/^[A-Z]$/.test(city)) throw new Error("請選擇縣市")
  const landNumber = extractLandNumber(cadastralIdentifier)
  const locationName = normalizeName(cadastralIdentifier)
    .replace(/(?:\d{1,4})(?:-\d{1,4})?(?:地號)?$/, "")

  const response = await fetcher(OFFICIAL_LAND_SECTION_ENDPOINT, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`官方段名資料服務回應錯誤（${response.status}）`)
  const records = collectRecords(await response.json())
  const matches = records.filter(record => {
    const recordCity = normalizeName(recordValue(record, "CITY"))
    const recordCityCode = normalizeName(recordValue(record, "CityCode"))
    const town = normalizeName(recordValue(record, "TOWN"))
    const section = withSuffix(recordValue(record, "Section"), "段")
    const subsection = withSuffix(recordValue(record, "SubSection"), "小段")
    const cityMatches = !recordCityCode || recordCityCode === city
    const cityNameMatches = !recordCity ||
      recordCity === city ||
      locationName.startsWith(recordCity)
    const townMatches = !town || locationName.includes(town)
    return cityMatches && cityNameMatches && townMatches &&
      Boolean(section) && locationName.endsWith(`${section}${subsection}`)
  })
  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? "查無對應段小段代碼，請確認完整地號"
      : "找到多個同名段小段，請手動確認代碼")
  }
  const sectionCode = String(
    recordValue(matches[0], "SectionCode") ?? "",
  ).trim().padStart(4, "0")
  if (!/^\d{4}$/.test(sectionCode)) throw new Error("官方資料缺少4碼段小段代碼")
  return sectionCode
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(collectRecords)
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).map(key => key.toLowerCase())
  const self = (
    keys.includes("landno") ||
    keys.includes("sectioncode")
  ) ? [record] : []
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
