import {
  extractionFieldKeys,
  type ExtractedField,
  type ExtractionFieldKey,
  type PropertyDocumentExtraction,
} from './propertyDocument'

type TesseractWorker = {
  recognize: (image: string) => Promise<{ data: { text: string; confidence: number } }>
  terminate: () => Promise<void>
}

type TesseractModule = {
  createWorker: (
    languages: string[],
    oem: number,
    options: {
      logger: (message: { status: string; progress: number }) => void
      workerPath: string
      corePath: string
      langPath: string
    },
  ) => Promise<TesseractWorker>
}

type TesseractImport = Partial<TesseractModule> & {
  default?: Partial<TesseractModule>
}

export type LocalOcrImage = { name: string; dataUrl: string }
export type OcrProgress = {
  imageIndex: number
  imageCount: number
  status: string
  progress: number
}

const TESSERACT_MODULE = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js'
const emptyField = (): ExtractedField => ({
  value: null,
  confidence: 0,
  evidence: null,
  imageIndex: null,
  conflict: false,
})

function normalizeText(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[，,]/g, '')
    .replace(/[：:]/g, ':')
    .replace(/[ \t]+/g, ' ')
}

function amountNear(text: string, labels: string[]) {
  const lines = normalizeText(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  for (const line of lines) {
    if (!labels.some(label => line.includes(label))) continue
    const numbers = [...line.matchAll(/(?:NT\$|新臺幣|新台幣)?\s*(\d{2,12})(?:\s*元)?/gi)]
      .map(match => Number(match[1]))
      .filter(value => Number.isFinite(value))
    if (numbers.length) return { value: Math.max(...numbers), evidence: line.slice(0, 100) }
  }
  return null
}

function dateNear(text: string, labels: string[]) {
  const lines = normalizeText(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  for (const line of lines) {
    if (!labels.some(label => line.includes(label))) continue
    const date = line.match(/(?:(民國)\s*)?(\d{2,4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?/)
    if (!date) continue
    let year = Number(date[2])
    if (date[1] || year < 1911) year += 1911
    const month = String(Number(date[3])).padStart(2, '0')
    const day = String(Number(date[4])).padStart(2, '0')
    return { value: `${year}-${month}-${day}`, evidence: line.slice(0, 100) }
  }
  return null
}

function numberNear(text: string, labels: string[], suffix: RegExp) {
  const lines = normalizeText(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  for (const line of lines) {
    if (!labels.some(label => line.includes(label))) continue
    const number = line.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${suffix.source}`))
    if (number) return { value: Number(number[1]), evidence: line.slice(0, 100) }
  }
  return null
}

export function parsePropertyText(
  text: string,
  imageIndex: number,
  ocrConfidence: number,
): Partial<Record<ExtractionFieldKey, ExtractedField>> {
  const normalized = normalizeText(text)
  const confidence = Math.max(0.35, Math.min(0.88, ocrConfidence / 100))
  const result: Partial<Record<ExtractionFieldKey, ExtractedField>> = {}
  const set = (key: ExtractionFieldKey, found: { value: string | number; evidence: string } | null) => {
    if (found) result[key] = {
      ...found,
      confidence,
      imageIndex,
      conflict: false,
    }
  }

  set('purchaseDate', dateNear(normalized, ['成交日期', '買賣日期', '簽約日期', '立契日期']))
  set('purchasePrice', amountNear(normalized, ['買賣總價', '成交總價', '房地總價', '買賣價款']))
  set('deedTax', amountNear(normalized, ['契稅']))
  set('stampTax', amountNear(normalized, ['印花稅']))
  set('registrationFees', amountNear(normalized, ['登記規費', '登記費', '規費']))
  set('agencyFee', amountNear(normalized, ['仲介服務費', '仲介費']))
  set('legalFee', amountNear(normalized, ['代書費', '地政士費']))
  set('otherCosts', amountNear(normalized, ['其他費用', '其他成本']))
  set('originalLoan', amountNear(normalized, ['原始貸款', '核貸金額', '借款金額', '貸款本金']))
  set('currentLoanBalance', amountNear(normalized, ['貸款餘額', '本金餘額', '未償本金']))
  set('totalMortgagePaymentsPaid', amountNear(normalized, ['累積繳款', '累計繳款']))
  set('annualRate', numberNear(normalized, ['貸款利率', '年利率', '目前利率'], /(?:%|％)/))
  set('remainingLoanYears', numberNear(normalized, ['剩餘年限', '剩餘期間'], /年/))

  const addressLine = normalized.split(/\r?\n/).find(line =>
    /(?:地址|標的|建物門牌)/.test(line) &&
    /(?:縣|市).*(?:區|鄉|鎮|市).*(?:路|街|巷|號)/.test(line),
  )
  if (addressLine) {
    const address = addressLine
      .replace(/^.*?(?:地址|標的|建物門牌)\s*[:：]?\s*/, '')
      .trim()
    if (address) set('address', { value: address, evidence: addressLine.slice(0, 100) })
  }
  return result
}

export function mergeParsedFields(
  parsedImages: Partial<Record<ExtractionFieldKey, ExtractedField>>[],
): PropertyDocumentExtraction {
  const fields = Object.fromEntries(extractionFieldKeys.map(key => {
    const candidates = parsedImages.flatMap(parsed => parsed[key] ? [parsed[key]!] : [])
    if (!candidates.length) return [key, emptyField()]
    const distinctValues = new Set(candidates.map(candidate => String(candidate.value)))
    const best = [...candidates].sort((a, b) => b.confidence - a.confidence)[0]
    return [key, { ...best, conflict: distinctValues.size > 1 }]
  })) as PropertyDocumentExtraction['fields']
  const conflicts = extractionFieldKeys.filter(key => fields[key].conflict)
  return {
    documentType: 'mixed',
    fields,
    warnings: conflicts.map(key => `${key} 在不同照片中辨識到不同內容，請對照原圖確認。`),
  }
}

export async function recognizePropertyImages(
  images: LocalOcrImage[],
  onProgress: (progress: OcrProgress) => void,
): Promise<PropertyDocumentExtraction> {
  const imported = await import(/* @vite-ignore */ TESSERACT_MODULE) as TesseractImport
  const createWorker = imported.createWorker ?? imported.default?.createWorker
  if (typeof createWorker !== 'function') {
    throw new Error('免費 OCR 元件載入失敗，請重新整理後再試。')
  }
  let currentImage = 0
  const worker = await createWorker(['chi_tra', 'eng'], 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: message => onProgress({
      imageIndex: currentImage + 1,
      imageCount: images.length,
      status: message.status,
      progress: message.progress,
    }),
  })
  const parsed = []
  try {
    for (const [index, image] of images.entries()) {
      currentImage = index
      const { data } = await worker.recognize(image.dataUrl)
      parsed.push(parsePropertyText(data.text, index + 1, data.confidence))
    }
  } finally {
    await worker.terminate()
  }
  return mergeParsedFields(parsed)
}
