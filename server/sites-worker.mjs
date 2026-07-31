const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const MAX_IMAGES = 20
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_BATCH_BYTES = 40 * 1024 * 1024
const fieldKeys = [
  'address', 'purchaseDate', 'purchasePrice', 'deedTax', 'stampTax',
  'registrationFees', 'agencyFee', 'legalFee', 'otherCosts', 'originalLoan',
  'currentLoanBalance', 'totalMortgagePaymentsPaid', 'annualRate',
  'remainingLoanYears',
]
const fieldSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    value: { type: ['string', 'number', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    evidence: { type: ['string', 'null'] },
    imageIndex: { type: ['integer', 'null'] },
    conflict: { type: 'boolean' },
  },
  required: ['value', 'confidence', 'evidence', 'imageIndex', 'conflict'],
}
const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    documentType: {
      type: 'string',
      enum: ['purchase_contract', 'tax_receipt', 'mortgage_statement', 'mixed', 'other'],
    },
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(fieldKeys.map(key => [key, fieldSchema])),
      required: fieldKeys,
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['documentType', 'fields', 'warnings'],
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function validateImages(images) {
  if (!Array.isArray(images) || images.length === 0) return '請至少選擇一張照片。'
  if (images.length > MAX_IMAGES) return `一次最多辨識 ${MAX_IMAGES} 張照片。`
  let total = 0
  for (const [index, image] of images.entries()) {
    const match = image?.dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
    if (!match) return `第 ${index + 1} 張只接受 JPEG、PNG 或 WebP。`
    const bytes = Math.floor(match[2].length * 0.75)
    if (bytes > MAX_IMAGE_BYTES) return `第 ${index + 1} 張不可超過 10 MB。`
    total += bytes
  }
  return total > MAX_BATCH_BYTES ? '這批照片合計不可超過 40 MB。' : null
}

function validateExtraction(data, imageCount) {
  if (!data?.fields || !Array.isArray(data.warnings)) return false
  return fieldKeys.every(key => {
    const item = data.fields[key]
    return item &&
      (item.value === null || typeof item.value === 'string' || typeof item.value === 'number') &&
      typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1 &&
      (item.evidence === null || typeof item.evidence === 'string') &&
      (item.imageIndex === null || (
        Number.isInteger(item.imageIndex) && item.imageIndex >= 1 && item.imageIndex <= imageCount
      )) &&
      typeof item.conflict === 'boolean'
  })
}

function readOutputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return null
}

async function recognize(request, env) {
  if (!env.OPENAI_API_KEY) return json({ error: 'AI 辨識服務尚未完成金鑰設定。' }, 503)
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: '請求格式錯誤。' }, 415)
  }
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 55 * 1024 * 1024) return json({ error: '上傳內容過大。' }, 413)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '請求格式錯誤。' }, 400)
  }
  const imageError = validateImages(body.images)
  if (imageError) return json({ error: imageError }, 400)

  const imageContent = body.images.flatMap((image, index) => [
    {
      type: 'input_text',
      text: `照片 ${index + 1}，檔名：${String(image.name || `image-${index + 1}`).slice(0, 120)}`,
    },
    { type: 'input_image', image_url: image.dataUrl, detail: 'high' },
  ])
  const openaiResponse = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_VISION_MODEL || 'gpt-5.6-terra',
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
          schema: extractionSchema,
        },
      },
    }),
  })
  const payload = await openaiResponse.json().catch(() => null)
  if (!openaiResponse.ok) {
    const requestId = openaiResponse.headers.get('x-request-id')
    return json({
      error: '雲端 AI 辨識失敗，請稍後再試。',
      requestId,
    }, openaiResponse.status === 429 ? 429 : 502)
  }
  const text = readOutputText(payload)
  if (!text) return json({ error: 'AI 沒有回傳可讀取的辨識結果。' }, 502)

  let extraction
  try {
    extraction = JSON.parse(text)
  } catch {
    return json({ error: 'AI 回傳格式無法解析。' }, 502)
  }
  if (!validateExtraction(extraction, body.images.length)) {
    return json({ error: 'AI 回傳欄位未通過伺服器校驗。' }, 502)
  }
  return json({
    extraction,
    model: payload.model || env.OPENAI_VISION_MODEL || 'gpt-5.6-terra',
    requestId: openaiResponse.headers.get('x-request-id'),
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/property-recognition' && request.method === 'POST') {
      return recognize(request, env)
    }
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({ status: 'ok', recognitionConfigured: Boolean(env.OPENAI_API_KEY) })
    }
    return env.ASSETS.fetch(request)
  },
}

