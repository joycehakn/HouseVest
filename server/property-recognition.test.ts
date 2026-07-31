import { describe, expect, it, vi } from 'vitest'
import { fieldKeys } from './property-extraction-schema.mjs'
import { recognizePropertyDocuments, validateImages } from './property-recognition.mjs'

const emptyFields = Object.fromEntries(fieldKeys.map(key => [
  key, { value: null, confidence: 0, evidence: null, imageIndex: null, conflict: false },
]))

describe('property recognition backend', () => {
  it('validates multi-image batches before calling the cloud', () => {
    expect(validateImages([]).ok).toBe(false)
    expect(validateImages([{ name: 'a.png', dataUrl: 'data:image/png;base64,AAAA' }]).ok).toBe(true)
    expect(validateImages([{ name: 'a.pdf', dataUrl: 'data:application/pdf;base64,AAAA' }]).ok).toBe(false)
  })

  it('sends all images in a private structured request', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: 'test-model',
        output_text: JSON.stringify({
          documentType: 'mixed', fields: emptyFields, warnings: [],
        }),
      }),
      headers: new Headers({ 'x-request-id': 'request-1' }),
    }))
    const result = await recognizePropertyDocuments({
      images: [
        { name: 'page-1.png', dataUrl: 'data:image/png;base64,AAAA' },
        { name: 'page-2.jpg', dataUrl: 'data:image/jpeg;base64,AAAA' },
      ],
      apiKey: 'server-only-key',
      model: 'test-model',
      fetchImpl: fetchImpl as typeof fetch,
    })
    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(request.store).toBe(false)
    expect(request.text.format.strict).toBe(true)
    expect(request.input[0].content.filter((item: { type: string }) => item.type === 'input_image')).toHaveLength(2)
    expect(result.requestId).toBe('request-1')
  })
})

