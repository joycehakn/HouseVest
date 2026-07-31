import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { recognizePropertyDocuments, RecognitionError } from './property-recognition.mjs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const port = Number(process.env.AI_SERVER_PORT || 8787)
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173'

function sendJson(response, status, body, origin) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 55 * 1024 * 1024) throw new RecognitionError(413, '上傳內容過大。')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RecognitionError(400, '請求格式錯誤。')
  }
}

createServer(async (request, response) => {
  const origin = request.headers.origin || allowedOrigin
  if (origin !== allowedOrigin) {
    sendJson(response, 403, { error: '不允許的網頁來源。' }, allowedOrigin)
    return
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    })
    response.end()
    return
  }
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      recognitionConfigured: Boolean(process.env.OPENAI_API_KEY),
    }, origin)
    return
  }
  if (request.method !== 'POST' || request.url !== '/api/property-recognition') {
    sendJson(response, 404, { error: '找不到此服務。' }, origin)
    return
  }
  try {
    const body = await readJson(request)
    const result = await recognizePropertyDocuments({
      images: body.images,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_VISION_MODEL,
    })
    sendJson(response, 200, result, origin)
  } catch (error) {
    const status = error instanceof RecognitionError ? error.status : 500
    sendJson(response, status, {
      error: error instanceof Error ? error.message : '無法完成辨識。',
    }, origin)
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`HouseVest AI server listening on http://127.0.0.1:${port}`)
})

