import { propertyExtractionSchema, validateExtraction } from './property-extraction-schema.mjs'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = 'gpt-5.6-terra'
export const MAX_IMAGES = 20
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_BATCH_BYTES = 40 * 1024 * 1024

function imageBytes(imageDataUrl) {
  const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  return match ? Math.floor(match[2].length * 0.75) : null
}

export function validateImages(images) {
  if (!Array.isArray(images) || images.length === 0) return { ok: false, message: '請至少選擇一張照片。' }
  if (images.length > MAX_IMAGES) return { ok: false, message: `一次最多辨識 ${MAX_IMAGES} 張照片。` }
  let totalBytes = 0
  for (const [index, image] of images.entries()) {
    const bytes = imageBytes(image?.dataUrl)
    if (bytes === null) return { ok: false, message: `第 ${index + 1} 張只接受 JPEG、PNG 或 WebP。` }
    if (bytes > MAX_IMAGE_BYTES) return { ok: false, message: `第 ${index + 1} 張不可超過 10 MB。` }
    totalBytes += bytes
  }
  if (totalBytes > MAX_BATCH_BYTES) return { ok: false, message: '這批照片合計不可超過 40 MB。' }
  return { ok: true }
}

function outputText(response) {
  if (typeof response.output_text === 'string') return response.output_text
  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return null
}

export async function recognizePropertyDocuments({
  images,
  apiKey,
  model = DEFAULT_MODEL,
  fetchImpl = fetch,
}) {
  const validation = validateImages(images)
  if (!validation.ok) throw new RecognitionError(400, validation.message)
  if (!apiKey) throw new RecognitionError(503, 'AI 辨識服務尚未設定。')

  const imageContent = images.flatMap((image, index) => [
    { type: 'input_text', text: `照片 ${index + 1}，檔名：${String(image.name || `image-${index + 1}`).slice(0, 120)}` },
    { type: 'input_image', image_url: image.dataUrl, detail: 'high' },
  ])
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [{
        role: 'user',
        content: [{
          type: 'input_text',
          text: [
            '你是台灣不動產多頁文件資料擷取器。請一起閱讀以下照片。',
            '只擷取圖片清楚可見的資料，不可推測或自行計算。',
            '金額輸出新台幣數字；日期使用 YYYY-MM-DD；年利率輸出百分比數字（例如 2.18）。',
            '找不到的欄位回傳 null、confidence 0、evidence null、imageIndex null。',
            'evidence 寫出可核對的鄰近文字，imageIndex 填最主要來源照片的 1 起算編號。',
            '若多張照片的同一欄位不一致，conflict 必須為 true、降低 confidence，並寫入 warnings，不可擅自選定。',
          ].join('\n'),
        }, ...imageContent],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'property_document_extraction',
          strict: true,
          schema: propertyExtractionSchema,
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.error?.message || '雲端 AI 辨識失敗，請稍後再試。'
    throw new RecognitionError(response.status >= 500 ? 502 : response.status, message)
  }
  const text = outputText(payload)
  if (!text) throw new RecognitionError(502, 'AI 沒有回傳可讀取的辨識結果。')

  let extraction
  try {
    extraction = JSON.parse(text)
  } catch {
    throw new RecognitionError(502, 'AI 回傳格式無法解析。')
  }
  if (!validateExtraction(extraction, images.length)) {
    throw new RecognitionError(502, 'AI 回傳欄位未通過伺服器校驗。')
  }
  return {
    extraction,
    model: payload.model ?? model,
    requestId: response.headers.get('x-request-id') ?? null,
  }
}

export class RecognitionError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

