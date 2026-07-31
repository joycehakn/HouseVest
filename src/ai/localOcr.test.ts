import { describe, expect, it } from 'vitest'
import { mergeParsedFields, parsePropertyText } from './localOcr'

describe('local property OCR parser', () => {
  it('extracts Taiwanese dates, prices, tax and mortgage fields', () => {
    const parsed = parsePropertyText(`
      買賣總價：新臺幣 15,800,000 元
      成交日期：民國 113 年 5 月 2 日
      契稅：98,500 元
      本金餘額：10,200,000 元
      年利率：2.18 %
    `, 1, 90)
    expect(parsed.purchasePrice?.value).toBe(15_800_000)
    expect(parsed.purchaseDate?.value).toBe('2024-05-02')
    expect(parsed.deedTax?.value).toBe(98_500)
    expect(parsed.currentLoanBalance?.value).toBe(10_200_000)
    expect(parsed.annualRate?.value).toBe(2.18)
  })

  it('marks values from different photos as conflicts', () => {
    const first = parsePropertyText('買賣總價：15,800,000 元', 1, 90)
    const second = parsePropertyText('買賣總價：16,000,000 元', 2, 90)
    const merged = mergeParsedFields([first, second])
    expect(merged.fields.purchasePrice.conflict).toBe(true)
    expect(merged.warnings).toHaveLength(1)
  })
})

