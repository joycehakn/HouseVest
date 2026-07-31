import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Building2, Calculator, Camera, CircleHelp, HousePlus, Landmark, LineChart as LineChartIcon, Pencil, PiggyBank, Plus, RefreshCw, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import {
  calculatePropertyAnalysis,
  calculateHoldingPeriod,
  mortgagePayment,
  type PropertyInputs as Inputs,
} from './calculations/propertyAnalysis'
import {
  defaultProperty,
  loadPropertyDatabase,
  savePropertyDatabase,
  totalAcquisitionCosts,
  type PropertyDatabase,
  type PropertyProfile,
} from './properties/propertyProfiles'
import { DocumentRecognition } from './ai/DocumentRecognition'
import {
  estimateLandPriceIncrementTotal,
  type LandPriceIncrementParcel,
} from './tax/taiwanPropertyTax'
import {
  extractLandNumber,
  fetchOfficialLandValue,
  fetchOfficialSectionCode,
  inferCityCode,
} from './land/officialLandValue'
import { fetchTaxCpi } from './land/taxCpi'
import { addYears, createDateScenarioComparisons } from './scenarios/dateScenarios'
import {
  createValidationCase,
  loadValidationCase,
  saveValidationCase,
  type ValidationField,
  type ValidationStatus,
} from './validation/validationCase'

const landCityOptions = [
  ['A', '臺北市'], ['F', '新北市'], ['H', '桃園市'], ['B', '臺中市'],
  ['D', '臺南市'], ['E', '高雄市'], ['C', '基隆市'], ['O', '新竹市'],
  ['I', '嘉義市'], ['G', '宜蘭縣'], ['J', '新竹縣'], ['K', '苗栗縣'],
  ['N', '彰化縣'], ['M', '南投縣'], ['P', '雲林縣'], ['Q', '嘉義縣'],
  ['T', '屏東縣'], ['U', '花蓮縣'], ['V', '臺東縣'], ['W', '金門縣'],
  ['X', '澎湖縣'], ['Z', '連江縣'],
] as const

type ScenarioInputs = {
  salePrice: number
  sellingAgencyFeeRate: number
  customSellingCosts: { id: string; name: string; amount: number; documented: boolean }[]
  saleDate: string
}

const initialScenario: ScenarioInputs = {
  salePrice: 17_500_000,
  sellingAgencyFeeRate: 4,
  customSellingCosts: [],
  saleDate: '2026-08-01',
}

const money = (n: number) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(Math.round(n))
const pct = (n: number) => `${n.toFixed(1)}%`
const nt = (n: number) => money(n)
const wan = (n: number) => `${new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n / 10_000)} 萬`
const dayAfter = (date: string) => {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

type CalculationDetail = {
  title: string
  result: string
  summary: string
  formula: string
  rows: {
    label: string
    value: string
    operator?: string
    noteAbove?: string
    children?: { label: string; value: string }[]
  }[]
  note?: string
}

function App() {
  const [database, setDatabase] = useState<PropertyDatabase>(() =>
    loadPropertyDatabase(window.localStorage),
  )
  const activeProperty =
    database.properties.find(property => property.id === database.activePropertyId) ??
    database.properties[0] ??
    defaultProperty
  const [scenario, setScenario] = useState<ScenarioInputs>(() => ({
    ...initialScenario,
    salePrice: activeProperty.currentMarketValue,
  }))
  const [editingProperty, setEditingProperty] = useState<PropertyProfile | null>(null)
  const [detail, setDetail] = useState<CalculationDetail | null>(null)
  const [comparisonMode, setComparisonMode] = useState<'price' | 'date'>('price')
  const inputs = useMemo<Inputs>(() => ({
    purchasePrice: activeProperty.purchasePrice,
    acquisitionCosts: totalAcquisitionCosts(
      activeProperty.acquisitionCosts,
      activeProperty.customAcquisitionCosts,
    ),
    originalLoan: activeProperty.originalLoan,
    currentLoanBalance: activeProperty.currentLoanBalance,
    mortgageDataDate: activeProperty.mortgageDataDate,
    mortgagePaymentDay: activeProperty.mortgagePaymentDay,
    totalMortgagePaymentsPaid: activeProperty.totalMortgagePaymentsPaid,
    mortgagePaymentMode: activeProperty.mortgagePaymentMode,
    paymentEstimateAnnualRate: activeProperty.paymentEstimateAnnualRate,
    originalLoanTermYears: activeProperty.originalLoanTermYears,
    annualRate: activeProperty.annualRate,
    remainingLoanYears: activeProperty.remainingLoanYears,
    purchaseDate: activeProperty.purchaseDate,
    salePrice: scenario.salePrice,
    sellingAgencyFeeRate: scenario.sellingAgencyFeeRate,
    otherSellingCosts: scenario.customSellingCosts.reduce(
      (total, cost) => total + cost.amount,
      0,
    ),
    documentedOtherSellingCosts: scenario.customSellingCosts.reduce(
      (total, cost) => total + (cost.documented ? cost.amount : 0),
      0,
    ),
    taxProfile: activeProperty.taxProfile,
    saleDate: scenario.saleDate,
  }), [activeProperty, scenario])
  const result = useMemo(() => calculatePropertyAnalysis(inputs), [inputs])
  const [validationCase, setValidationCase] = useState(() =>
    loadValidationCase(window.localStorage) ??
    createValidationCase(activeProperty, scenario, result),
  )
  useEffect(() => {
    saveValidationCase(window.localStorage, validationCase)
  }, [validationCase])
  const incomeTaxItemLabel = result.taxAnalysis.regime === 'legacy'
    ? '舊制財產交易所得稅'
    : `房地交易所得稅（${result.taxAnalysis.regimeLabel}）`
  const enteredAcquisitionCosts = useMemo(() => [
    { label: '契稅', value: activeProperty.acquisitionCosts.deedTax },
    { label: '印花稅', value: activeProperty.acquisitionCosts.stampTax },
    { label: '登記與規費', value: activeProperty.acquisitionCosts.registrationFees },
    { label: '購入仲介費', value: activeProperty.acquisitionCosts.agencyFee },
    { label: '代書費', value: activeProperty.acquisitionCosts.legalFee },
  ].filter(cost => cost.value > 0).concat(
    activeProperty.customAcquisitionCosts
      .filter(cost => cost.name.trim() !== '' || cost.amount > 0)
      .map(cost => ({
      label: cost.name.trim() || '自訂取得成本',
      value: cost.amount,
      })),
  ), [activeProperty])
  const enteredSellingCosts = useMemo(() => [
    ...(result.sellingAgencyFee > 0
      ? [{ label: `出售仲介費（${inputs.sellingAgencyFeeRate}%）`, value: result.sellingAgencyFee, documented: true }]
      : []),
    ...scenario.customSellingCosts
      .filter(cost => cost.name.trim() !== '' || cost.amount > 0)
      .map(cost => ({
        label: cost.name.trim() || '自訂出售成本',
        value: cost.amount,
        documented: cost.documented,
      })),
  ], [inputs.sellingAgencyFeeRate, result.sellingAgencyFee, scenario.customSellingCosts])
  const scenarioComparisons = useMemo(() => [
    { offset: -1_000_000, label: '−100 萬' },
    { offset: -500_000, label: '−50 萬' },
    { offset: 0, label: '基準情境' },
    { offset: 500_000, label: '＋50 萬' },
    { offset: 1_000_000, label: '＋100 萬' },
  ].map(item => {
    const salePrice = Math.max(0, inputs.salePrice + item.offset)
    return {
      ...item,
      salePrice,
      result: calculatePropertyAnalysis({ ...inputs, salePrice }),
    }
  }), [inputs])
  const dateComparisons = useMemo(() => createDateScenarioComparisons(inputs), [inputs])
  const comparisonItems = useMemo(() => comparisonMode === 'price'
    ? scenarioComparisons.map(item => ({
        key: `price-${item.offset}`,
        label: item.label,
        sublabel: nt(item.salePrice),
        salePrice: item.salePrice,
        saleDate: inputs.saleDate,
        baseline: item.offset === 0,
        adjustment: `${item.offset >= 0 ? '+' : '−'}${nt(Math.abs(item.offset))}`,
        result: item.result,
      }))
    : dateComparisons.map(item => ({
        key: `date-${item.key}`,
        label: item.label,
        sublabel: item.saleDate,
        salePrice: inputs.salePrice,
        saleDate: item.saleDate,
        baseline: item.key === 'base',
        adjustment: item.adjustment,
        result: item.result,
      })), [comparisonMode, dateComparisons, inputs.saleDate, inputs.salePrice, scenarioComparisons])
  const scenarioChartData = useMemo(() => comparisonItems.map(item => ({
    name: item.label,
    tax: item.result.tax,
    profit: item.result.profit,
  })), [comparisonItems])
  const dateMilestones = useMemo(() => {
    const holdingFiveYears = addYears(inputs.purchaseDate, 5)
    const ownershipSixYears = addYears(inputs.purchaseDate, 6)
    const registrationSixYears = inputs.taxProfile.householdRegistrationDate
      ? addYears(inputs.taxProfile.householdRegistrationDate, 6)
      : null
    return [
      {
        label: '持有滿 5 年',
        date: holdingFiveYears,
        note: `一般稅率須於 ${dayAfter(holdingFiveYears)} 起視為超過 5 年`,
      },
      {
        label: '持有並設籍滿 6 年',
        date: registrationSixYears
          ? (registrationSixYears > ownershipSixYears ? registrationSixYears : ownershipSixYears)
          : null,
        note: registrationSixYears
          ? '仍須確認連續實住、未出租營業及家庭未重複使用優惠'
          : '待輸入設籍日期後計算',
      },
    ]
  }, [inputs.purchaseDate, inputs.taxProfile.householdRegistrationDate])

  const details = useMemo<Record<string, CalculationDetail>>(() => ({
    marketValue: {
      title: '預估市值',
      result: nt(inputs.salePrice),
      summary: '這是成交價情境的輸入值，其他出售分析都從這個數字開始。',
      formula: '預估市值 = 使用者設定的預估成交價',
      rows: [{ label: '預估成交價', value: nt(inputs.salePrice) }],
    },
    balance: {
      title: '貸款餘額',
      result: nt(result.balance),
      summary: '這是使用者依銀行帳單手動輸入的目前貸款本金餘額，不再由利率公式反推。',
      formula: '目前貸款餘額 = 使用者輸入的銀行帳單餘額',
      rows: [
        { label: '貸款資料截至日', value: inputs.mortgageDataDate },
        { label: '銀行帳單貸款餘額', value: nt(inputs.currentLoanBalance) },
        { label: '目前利率（未來假設）', value: `${inputs.annualRate}%` },
        { label: '剩餘貸款年限', value: `${inputs.remainingLoanYears} 年` },
        { label: '依目前條件預估未來月付', value: nt(result.futureMonthlyPayment) },
        { label: '目前貸款餘額', value: nt(result.balance), operator: '=' },
      ],
      note: '目前利率不參與今天的餘額計算，只作為未來 Scenario 的預測假設；未來若再次升降息，預測仍需更新。',
    },
    equity: {
      title: '房屋淨值',
      result: nt(result.equity),
      summary: '房屋目前價值扣掉仍需償還的貸款本金。',
      formula: '房屋淨值 = 預估市值 − 貸款餘額',
      rows: [
        { label: '預估市值', value: nt(inputs.salePrice) },
        { label: '貸款餘額', value: nt(result.balance), operator: '−' },
        { label: '房屋淨值', value: nt(result.equity), operator: '=' },
      ],
    },
    netCash: {
      title: '出售實拿',
      result: nt(result.netCash),
      summary: '出售成交後，依目前簡化假設扣除出售成本、所得稅與貸款清償的現金。',
      formula: '出售實拿 = 售價 − 出售成本 − 稅額 − 貸款餘額',
      rows: [
        { label: '預估成交價', value: nt(inputs.salePrice) },
        { label: `出售仲介費（${inputs.sellingAgencyFeeRate}%）`, value: nt(result.sellingAgencyFee), operator: '−' },
        { label: '其他出售成本', value: nt(result.otherSellingCosts), operator: '−' },
        { label: incomeTaxItemLabel, value: nt(result.taxAnalysis.houseLandIncomeTax ?? 0), operator: '−' },
        { label: '土地增值稅', value: nt(result.taxAnalysis.landValueIncrementTax), operator: '−' },
        { label: '貸款餘額', value: nt(result.balance), operator: '−' },
        { label: '出售實拿', value: nt(result.netCash), operator: '=' },
      ],
      note: result.taxAnalysis.complete ? result.taxAnalysis.rateReason : `尚缺：${result.taxAnalysis.missingData.join('、')}。目前結果僅供試算。`,
    },
    transactionTax: {
      title: '房地交易所得稅初估',
      result: nt(result.tax),
      summary: `${result.taxAnalysis.regimeLabel}；${result.taxAnalysis.rateReason}。`,
      formula: '退稅後淨稅費 = 房地交易所得稅 + 土地增值稅 − 房地合一重購退稅 − 土地增值稅重購退稅',
      rows: [
        { label: '預估成交價', value: nt(inputs.salePrice) },
        { label: '購入價格', value: nt(inputs.purchasePrice), operator: '−' },
        {
          label: `可辨識取得成本（${enteredAcquisitionCosts.length} 項）`,
          value: nt(inputs.acquisitionCosts),
          operator: '−',
          children: enteredAcquisitionCosts.map(cost => ({
            label: cost.label,
            value: nt(cost.value),
          })),
        },
        {
          label: `稅法認列出售費用（自動採${result.taxAnalysis.recognizedSellingExpenseMethod === 'documented' ? '實際憑證' : '法定推計'}）`,
          value: nt(result.taxAnalysis.recognizedSellingExpenses),
          operator: '−',
          children: [
            ...enteredSellingCosts.map(cost => ({
              label: `目前項目：${cost.label}${cost.documented ? '（有憑證）' : '（無憑證，不列入實際憑證合計）'}`,
              value: nt(cost.value),
            })),
            { label: '目前實際憑證合計', value: nt(result.taxAnalysis.documentedSellingExpenses) },
            { label: '法定推計額（成交價3%，最高30萬）', value: nt(result.taxAnalysis.statutorySellingExpenses) },
            { label: '建議認列方式', value: result.taxAnalysis.recognizedSellingExpenseMethod === 'documented' ? '採實際憑證' : '採法定推計' },
            { label: '最終認列金額', value: nt(result.taxAnalysis.recognizedSellingExpenses) },
          ],
        },
        { label: '交易所得', value: nt(result.taxAnalysis.transactionIncome), operator: '=' },
        { label: '前3年房地交易損失', value: nt(inputs.taxProfile.priorThreeYearTransactionLoss), operator: '−' },
        {
          label: '土地漲價總數額',
          value: inputs.taxProfile.landPriceIncrementTotal === null ? '尚未填寫' : nt(inputs.taxProfile.landPriceIncrementTotal),
          operator: '−',
          noteAbove: inputs.taxProfile.landPriceIncrementSource === 'estimate'
            ? '已套用財政部試算欄預估'
            : undefined,
        },
        { label: '課稅所得', value: nt(result.taxAnalysis.taxableIncome), operator: '=' },
        ...(result.taxAnalysis.selfUseQualified ? [{ label: '自住房地免稅額', value: nt(result.taxAnalysis.selfUseExemption), operator: '−' }] : []),
        { label: `適用稅率 ${result.taxAnalysis.appliedRate ?? '—'}%`, value: nt(result.taxAnalysis.houseLandIncomeTax ?? 0), operator: '×' },
        { label: incomeTaxItemLabel, value: nt(result.taxAnalysis.houseLandIncomeTax ?? 0), operator: '=' },
        { label: '土地增值稅', value: inputs.taxProfile.landValueIncrementTax === null ? '尚未填寫' : nt(result.taxAnalysis.landValueIncrementTax), operator: '+' },
        { label: '稅費合計（退稅前）', value: nt(result.taxAnalysis.totalTax ?? 0), operator: '=' },
        { label: '房地合一重購退稅', value: nt(result.taxAnalysis.houseLandRepurchaseRefund), operator: '−' },
        { label: '土地增值稅重購退稅', value: nt(result.taxAnalysis.landValueRepurchaseRefund), operator: '−' },
        { label: '退稅後淨稅費', value: nt(result.tax), operator: '=' },
      ],
      note: result.taxAnalysis.complete
        ? `資料已齊全；仍應以稽徵機關核定為準。${result.taxAnalysis.warnings.join(' ')}`
        : `尚缺：${result.taxAnalysis.missingData.join('、')}。${result.taxAnalysis.warnings.join(' ')}`,
    },
    cagr: {
      title: '房屋 CAGR',
      result: pct(result.cagr),
      summary: '衡量房屋整體取得成本，在扣除出售成本與簡化稅額後的年化成長率；不計房貸。',
      formula: 'CAGR = [(稅後出售價 ÷ 總取得成本)^(1 ÷ 持有年數) − 1] × 100%',
      rows: [
        { label: '購入價格', value: nt(inputs.purchasePrice) },
        { label: '取得成本', value: nt(inputs.acquisitionCosts), operator: '+' },
        { label: '總取得成本', value: nt(result.totalCost), operator: '=' },
        { label: '扣成本與稅後出售價', value: nt(result.netSaleBeforeLoan) },
        { label: '購入成交日', value: inputs.purchaseDate },
        { label: '出售成交日', value: inputs.saleDate },
        { label: '實際持有期間', value: `${money(result.holdingDays)} 天（${result.holdingYears.toFixed(3)} 年）` },
        { label: '房屋 CAGR', value: pct(result.cagr), operator: '=' },
      ],
      note: 'CAGR 是房屋資產本身的年化結果，不包含房貸本金、利息與每月現金流。',
    },
    irr: {
      title: '自有資金 IRR',
      result: Number.isFinite(result.leveragedIrr) ? pct(result.leveragedIrr) : '無法計算',
      summary: '使用逐月現金流計算：期初自有資金、每月房貸付款，以及出售月份收到的出售實拿。',
      formula: '找到月報酬率 r，使所有逐月現金流的 NPV = 0，再換算成年化 IRR',
      rows: [
        { label: '購入至出售日期', value: `${inputs.purchaseDate} → ${inputs.saleDate}` },
        { label: '期初自有資金', value: `−${nt(result.initialEquity)}` },
        { label: '貸款資料截至日', value: inputs.mortgageDataDate },
        { label: '每月房貸扣款日', value: `每月 ${inputs.mortgagePaymentDay} 日` },
        { label: '截至日付款來源', value: result.mortgagePaymentMode === 'actual' ? '手動輸入實際總額' : '本息平均攤還公式推估' },
        { label: '截至日已付款期數', value: `${result.historicalPaidMonths} 期` },
        { label: '截至日累積付款', value: `−${nt(result.historicalMortgagePayments)}` },
        { label: '截至日至出售日未來期數', value: `${result.futurePaymentMonths} 期` },
        { label: '未來預估月付', value: `−${nt(result.futureMonthlyPayment)}` },
        { label: '未來預估付款', value: `−${nt(result.futureMortgagePayments)}` },
        { label: '出售前累積房貸付款', value: `−${nt(result.totalMortgagePayments)}` },
        { label: '出售月份回收', value: nt(result.netCash) },
        { label: '年化 IRR', value: Number.isFinite(result.leveragedIrr) ? pct(result.leveragedIrr) : '無法計算', operator: '=' },
      ],
      note: `${result.mortgagePaymentMode === 'actual' ? '貸款資料截至日前採用手動輸入的實際總額' : `截至日前採公式推估（平均利率 ${inputs.paymentEstimateAnnualRate}%、原始年限 ${inputs.originalLoanTermYears} 年）`}；截至日後則依目前貸款餘額、目前利率與剩餘年限推估至出售日。`,
    },
    profit: {
      title: '稅後獲利',
      result: nt(result.profit),
      summary: `把出售實拿減去期初自有資金，以及持有期間${result.mortgagePaymentMode === 'actual' ? '實際輸入' : '公式推估'}的全部房貸款。`,
      formula: '稅後獲利 = 出售實拿 − 期初自有資金 − 累積房貸付款',
      rows: [
        {
          label: '出售實拿',
          value: nt(result.netCash),
          children: [
            { label: '預估成交價', value: nt(inputs.salePrice) },
            { label: `減：出售仲介費（${inputs.sellingAgencyFeeRate}%）`, value: nt(result.sellingAgencyFee) },
            { label: '減：其他出售成本', value: nt(result.otherSellingCosts) },
            { label: `減：${incomeTaxItemLabel}`, value: nt(result.taxAnalysis.houseLandIncomeTax ?? 0) },
            { label: '減：土地增值稅', value: nt(result.taxAnalysis.landValueIncrementTax) },
            { label: '減：貸款餘額', value: nt(result.balance) },
            { label: '等於：出售實拿', value: nt(result.netCash) },
          ],
        },
        { label: '期初自有資金', value: nt(result.initialEquity), operator: '−' },
        { label: `截至 ${inputs.mortgageDataDate} 累積付款`, value: nt(result.historicalMortgagePayments), operator: '−' },
        { label: '截至日至出售日預估付款', value: nt(result.futureMortgagePayments), operator: '−' },
        { label: '稅後獲利', value: nt(result.profit), operator: '=' },
      ],
      note: '此處的「稅後」沿用上方簡化稅額，且尚未納入持有稅費、裝修、修繕、租金與其他現金流。',
    },
    score: {
      title: 'HouseVest Score',
      result: `${result.score} / 100`,
      summary: '這是實驗性的產品指標，不是標準財務指標，也不應取代 CAGR 或 IRR。',
      formula: 'Score = 55 + CAGR×4 + IRR×1.8 − 房貸利率×2（限制在 0–100）',
      rows: [
        { label: '基礎分', value: '55' },
        { label: `CAGR ${pct(result.cagr)} × 4`, value: (result.cagr * 4).toFixed(1), operator: '+' },
        { label: `IRR ${pct(result.leveragedIrr)} × 1.8`, value: (result.leveragedIrr * 1.8).toFixed(1), operator: '+' },
        { label: `利率 ${inputs.annualRate}% × 2`, value: (inputs.annualRate * 2).toFixed(1), operator: '−' },
        { label: 'HouseVest Score', value: `${result.score}`, operator: '=' },
      ],
      note: '此權重尚未校準或驗證，只保留作為介面原型；進行投資判斷時請直接查看可驗證的財務數字。',
    },
  }), [enteredAcquisitionCosts, enteredSellingCosts, incomeTaxItemLabel, inputs, result])

  useEffect(() => {
    setDetail(current => {
      if (!current) return current
      return Object.values(details).find(item => item.title === current.title) ?? current
    })
  }, [details])

  const showScenarioDetail = (scenarioResult: typeof comparisonItems[number]) => {
    const comparison = scenarioResult.result
    const isPriceMode = comparisonMode === 'price'
    setDetail({
      title: `${scenarioResult.label}${isPriceMode ? '成交價' : '成交日期'}情境`,
      result: isPriceMode ? nt(scenarioResult.salePrice) : scenarioResult.saleDate,
      summary: isPriceMode
        ? '這五個情境只改變預估成交價，其餘房屋、貸款、成本與出售日期相同。'
        : '這五個情境只改變預估成交日期，成交價與其他成本假設相同；持有期間、房貸付款、稅率與績效會重新計算。',
      formula: isPriceMode ? '情境成交價 = 基準預估成交價 ± 情境差額' : '情境出售日 = 基準出售日 + 情境期間',
      rows: [
        { label: isPriceMode ? '基準預估成交價' : '基準出售日', value: isPriceMode ? nt(inputs.salePrice) : inputs.saleDate },
        { label: '情境調整', value: scenarioResult.adjustment },
        { label: '情境成交價', value: nt(scenarioResult.salePrice), operator: '=' },
        { label: '情境出售日', value: scenarioResult.saleDate },
        { label: '持有期間', value: `${comparison.holdingYears.toFixed(3)} 年` },
        { label: '推估適用稅率', value: comparison.taxAnalysis.appliedRate === null ? '資料不足' : `${comparison.taxAnalysis.appliedRate}%` },
        { label: `出售仲介費（${inputs.sellingAgencyFeeRate}%）`, value: nt(comparison.sellingAgencyFee), operator: '−' },
        { label: '其他出售成本', value: nt(comparison.otherSellingCosts), operator: '−' },
        { label: '出售成本合計', value: nt(comparison.saleCosts), operator: '=' },
        { label: '出售實拿', value: nt(comparison.netCash) },
        { label: '稅後獲利', value: nt(comparison.profit) },
        { label: '房屋 CAGR', value: pct(comparison.cagr) },
        { label: '自有資金 IRR', value: Number.isFinite(comparison.leveragedIrr) ? pct(comparison.leveragedIrr) : '無法計算' },
      ],
      note: '出售實拿已扣除出售成本、簡化稅額與貸款餘額；稅後獲利與 IRR 另納入期初自有資金、截至日房貸付款與出售前預估付款。',
    })
  }

  const updateScenarioNumber = (key: 'salePrice' | 'sellingAgencyFeeRate', value: number) =>
    setScenario(current => ({ ...current, [key]: value }))
  const updateSaleDate = (value: string) => setScenario(current => {
    if (value <= activeProperty.purchaseDate || value < activeProperty.mortgageDataDate) return current
    return { ...current, saleDate: value }
  })
  const addSellingCost = () => setScenario(current => ({
    ...current,
    customSellingCosts: [
      ...current.customSellingCosts,
      { id: crypto.randomUUID(), name: '', amount: 0, documented: true },
    ],
  }))
  const updateSellingCost = (
    id: string,
    changes: Partial<ScenarioInputs['customSellingCosts'][number]>,
  ) => setScenario(current => ({
    ...current,
    customSellingCosts: current.customSellingCosts.map(cost =>
      cost.id === id ? { ...cost, ...changes } : cost
    ),
  }))
  const removeSellingCost = (id: string) => setScenario(current => ({
    ...current,
    customSellingCosts: current.customSellingCosts.filter(cost => cost.id !== id),
  }))
  const storeDatabase = (nextDatabase: PropertyDatabase) => {
    setDatabase(nextDatabase)
    savePropertyDatabase(window.localStorage, nextDatabase)
  }
  const selectProperty = (propertyId: string) => {
    const selected = database.properties.find(property => property.id === propertyId)
    if (!selected) return
    storeDatabase({ ...database, activePropertyId: propertyId })
    setScenario(current => ({
      ...current,
      salePrice: selected.currentMarketValue,
      saleDate: current.saleDate < selected.mortgageDataDate
        ? selected.mortgageDataDate
        : current.saleDate,
    }))
  }
  const createProperty = () => {
    setEditingProperty({
      ...defaultProperty,
      id: crypto.randomUUID(),
      name: `房子 ${database.properties.length + 1}`,
      address: '',
      acquisitionCosts: {
        deedTax: 0,
        stampTax: 0,
        registrationFees: 0,
        agencyFee: 0,
        legalFee: 0,
      },
      customAcquisitionCosts: [],
      purchasePrice: 0,
      originalLoan: 0,
      currentLoanBalance: 0,
      mortgageDataDate: new Date().toISOString().slice(0, 10),
      mortgagePaymentMode: 'actual',
      totalMortgagePaymentsPaid: 0,
      paymentEstimateAnnualRate: 0,
      originalLoanTermYears: 30,
      currentMarketValue: 0,
    })
  }
  const persistProfile = (profile: PropertyProfile) => {
    const exists = database.properties.some(property => property.id === profile.id)
    const properties = exists
      ? database.properties.map(property => property.id === profile.id ? profile : property)
      : [...database.properties, profile]
    storeDatabase({ activePropertyId: profile.id, properties })
    setScenario(current => ({
      ...current,
      salePrice: profile.currentMarketValue,
      saleDate: current.saleDate < profile.mortgageDataDate
        ? dayAfter(profile.mortgageDataDate)
        : current.saleDate,
    }))
  }
  const updateAndPersistProfile = (profile: PropertyProfile) => {
    setEditingProperty(profile)
    persistProfile(profile)
  }
  const refreshValidationCase = () => {
    setValidationCase(createValidationCase(activeProperty, scenario, result))
  }
  const updateValidationStatus = (field: ValidationField, status: ValidationStatus) => {
    setValidationCase(current => ({
      ...current,
      fieldStatuses: { ...current.fieldStatuses, [field]: status },
    }))
  }

  const validationStatusSelect = (field: ValidationField, label: string) => (
    <select
      aria-label={`${label}資料狀態`}
      value={validationCase.fieldStatuses[field]}
      onChange={event => updateValidationStatus(field, event.target.value as ValidationStatus)}
    >
      <option value="confirmed">已確認</option>
      <option value="estimated">推估</option>
      <option value="pending">待補</option>
    </select>
  )

  return <div className="app">
    <aside>
      <div className="brand"><div className="logo">H</div><div><strong>HouseVest</strong><span>Property Intelligence</span></div></div>
      <nav>
        <button className="active"><Building2 size={18}/>Dashboard</button>
        <button><LineChartIcon size={18}/>投資分析</button>
        <button><PiggyBank size={18}/>出售分析</button>
        <button><Landmark size={18}/>房貸分析</button>
      </nav>
      <div className="version">Version 2.0 starter</div>
    </aside>

    <main>
      <section className="propertyBar">
        <label><span>目前房屋</span><select value={activeProperty.id} onChange={event => selectProperty(event.target.value)}>{database.properties.map(property => <option value={property.id} key={property.id}>{property.name}</option>)}</select></label>
        <div><button onClick={() => setEditingProperty(activeProperty)}><Pencil size={15}/>編輯基本資料</button><button onClick={createProperty}><HousePlus size={16}/>新增房屋</button></div>
      </section>
      <details className="validationCase" open>
        <summary><div><strong>案例 A</strong><span>以目前已儲存資料建立的固定驗算基準</span></div><small>{new Date(validationCase.createdAt).toLocaleString('zh-TW')}</small></summary>
        <div className="validationCaseBody">
          <div className="validationFacts">
            <p><span>購入價格</span><strong>{nt(validationCase.property.purchasePrice)}</strong>{validationStatusSelect('purchasePrice', '購入價格')}</p>
            <p><span>取得成本合計</span><strong>{nt(totalAcquisitionCosts(validationCase.property.acquisitionCosts, validationCase.property.customAcquisitionCosts))}</strong>{validationStatusSelect('acquisitionCosts', '取得成本合計')}</p>
            <p><span>目前貸款餘額</span><strong>{nt(validationCase.property.currentLoanBalance)}</strong>{validationStatusSelect('currentLoanBalance', '目前貸款餘額')}</p>
            <p><span>截至目前累積付款（公式推估）</span><strong>{nt(validationCase.result.historicalMortgagePayments ?? result.historicalMortgagePayments)}</strong>{validationStatusSelect('historicalMortgagePayments', '截至目前累積付款')}</p>
            <p><span>案例成交價</span><strong>{nt(validationCase.scenario.salePrice)}</strong>{validationStatusSelect('salePrice', '案例成交價')}</p>
            <p><span>出售仲介費率</span><strong>{pct(validationCase.scenario.sellingAgencyFeeRate)}</strong>{validationStatusSelect('sellingAgencyFeeRate', '出售仲介費率')}</p>
            <p><span>其他出售成本</span><strong>{nt(validationCase.scenario.customSellingCosts.reduce((total, cost) => total + cost.amount, 0))}</strong>{validationStatusSelect('otherSellingCosts', '其他出售成本')}</p>
            <p><span>適用稅制與持有期間</span><strong>{validationCase.taxReview?.regimeLabel ?? result.taxAnalysis.regimeLabel}・{(validationCase.taxReview?.holdingYears ?? result.taxAnalysis.holdingYears).toFixed(3)} 年</strong>{validationStatusSelect('taxRegimeAndHoldingPeriod', '適用稅制與持有期間')}</p>
            <p><span>可辨識取得成本</span><strong>{nt(totalAcquisitionCosts(validationCase.property.acquisitionCosts, validationCase.property.customAcquisitionCosts))}</strong>{validationStatusSelect('recognizedAcquisitionCosts', '可辨識取得成本')}</p>
            <p><span>稅法認列出售費用</span><strong>{nt(validationCase.taxReview?.recognizedSellingExpenses ?? result.taxAnalysis.recognizedSellingExpenses)}</strong>{validationStatusSelect('recognizedSellingExpenses', '稅法認列出售費用')}</p>
            <p><span>土地漲價總數額</span><strong>{validationCase.property.taxProfile.landPriceIncrementTotal === null ? '尚待交易時確認' : nt(validationCase.property.taxProfile.landPriceIncrementTotal)}</strong>{validationStatusSelect('landPriceIncrementTotal', '土地漲價總數額')}</p>
            <p><span>扣抵損失及自住、重購資格</span><strong>尚待交易時確認</strong>{validationStatusSelect('taxQualifications', '扣抵損失及自住、重購資格')}</p>
            <p><span>賣房稅費</span><strong>{nt(validationCase.result.tax)}</strong>{validationStatusSelect('tax', '賣房稅費')}</p>
            <p><span>稅後淨利</span><strong>{nt(validationCase.result.profit)}</strong>{validationStatusSelect('profit', '稅後淨利')}</p>
            <p><span>CAGR</span><strong>{pct(validationCase.result.cagr)}</strong>{validationStatusSelect('cagr', 'CAGR')}</p>
            <p><span>自有資金 IRR</span><strong>{Number.isFinite(validationCase.result.leveragedIrr) ? pct(validationCase.result.leveragedIrr) : '無法計算'}</strong>{validationStatusSelect('leveragedIrr', '自有資金 IRR')}</p>
          </div>
          <button type="button" onClick={refreshValidationCase}><RefreshCw size={14}/>以目前資料更新案例 A</button>
          <small>每個狀態都會立即保存。案例 A 的數字不會因後續修改而變動，除非按下更新。</small>
        </div>
      </details>
      <header><div><p className="eyebrow">MY PROPERTY</p><h1>{activeProperty.name}資產儀表板</h1><p>{activeProperty.address || '尚未設定地址'}・用同一組已儲存資料理解房價、貸款、稅金與自有資金績效。</p></div><button className="score" onClick={() => setDetail(details.score)}><span>HouseVest Score</span><strong>{result.score}</strong><small>/ 100</small><em>查看依據</em></button></header>

      <section className="metrics">
        <Card
          label="稅後淨利"
          value={`${wan(result.profit)}（稅金 ${wan(result.tax)}）`}
          note={`${result.taxAnalysis.regimeLabel}・查看淨利計算`}
          onClick={() => setDetail(details.profit)}
        />
        <Card
          label={`賣房稅費・${result.taxAnalysis.regimeLabel}`}
          value={`${wan(result.tax)}（稅前交易所得 ${wan(result.taxAnalysis.transactionIncome)}${result.taxAnalysis.complete ? '' : '・資料未齊'}）`}
          note="查看稅制、稅率與完整計算"
          onClick={() => setDetail(details.transactionTax)}
        />
      </section>

      <section className="grid">
        <article className="panel performance">
          <div className="panelTitle"><div><p className="eyebrow">SCENARIO COMPARISON</p><h2>{comparisonMode === 'price' ? '五種成交價情境比較' : '成交日期情境比較'}</h2></div><Sparkles size={20}/></div>
          <div className="comparisonMode" role="group" aria-label="情境比較模式"><button className={comparisonMode === 'price' ? 'active' : ''} onClick={() => setComparisonMode('price')}>成交價</button><button className={comparisonMode === 'date' ? 'active' : ''} onClick={() => setComparisonMode('date')}>成交日期</button></div>
          <p className="comparisonSummary">{comparisonMode === 'price'
            ? `固定出售日 ${inputs.saleDate}，以 ${nt(inputs.salePrice)} 為基準比較上下 50 萬與 100 萬。`
            : `固定成交價 ${nt(inputs.salePrice)}，比較基準日、半年後、1 年後與2 年後。`}</p>
          <div className="scenarioVisuals">
            <section className="scenarioChart">
              <h3>稅金與稅後淨利</h3>
              {comparisonMode === 'date' && <div className="dateMilestones" aria-label="持有與設籍法規時間點">{dateMilestones.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.date ?? '待輸入設籍日'}</strong><small>{item.note}</small></div>)}</div>}
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={scenarioChartData} margin={{ top: 32, right: 18, left: 5, bottom: 5 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis width={50} tick={{ fontSize: 10 }} tickFormatter={value => `${Math.round(Number(value) / 10_000)}萬`} />
                  <Tooltip formatter={(value, name) => [nt(Number(value)), name === 'tax' ? '稅金' : '稅後淨利']} labelFormatter={label => `${label}${comparisonMode === 'price' ? '成交價' : '成交日期'}情境`} />
                  <Legend formatter={value => value === 'tax' ? '稅金' : '稅後淨利'} />
                  <ReferenceLine y={0} stroke="#64748b" />
                  <Bar dataKey="tax" fill="#f59e0b" radius={[5, 5, 0, 0]}>
                    <LabelList dataKey="tax" position="top" formatter={value => `${Math.round(Number(value) / 10_000)}萬`} />
                  </Bar>
                  <Bar dataKey="profit" fill="#2563eb" radius={[5, 5, 0, 0]}>
                    <LabelList dataKey="profit" position="top" formatter={value => `${Math.round(Number(value) / 10_000)}萬`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>
          <details className="scenarioNumbers">
            <summary>查看完整數字與計算依據</summary>
            <div className="scenarioTableWrap">
              <table className="scenarioTable">
                <thead><tr><th>投資績效</th>{comparisonItems.map(item => <th className={item.baseline ? 'baseline' : ''} key={item.key}><span>{item.label}</span><strong>{item.sublabel}</strong></th>)}</tr></thead>
                <tbody>
                  {comparisonMode === 'date' && <tr><th>持有期間／稅率</th>{comparisonItems.map(item => <td className={item.baseline ? 'baseline' : ''} key={item.key}>{item.result.holdingYears.toFixed(2)} 年／{item.result.taxAnalysis.appliedRate === null ? '待補' : `${item.result.taxAnalysis.appliedRate}%`}</td>)}</tr>}
                  <tr><th>賣房稅費初估</th>{comparisonItems.map(item => <td className={item.baseline ? 'baseline' : ''} key={item.key}>{nt(item.result.tax)}</td>)}</tr>
                  <tr><th>稅後淨利</th>{comparisonItems.map(item => <td className={item.baseline ? 'baseline' : ''} key={item.key}>{nt(item.result.profit)}</td>)}</tr>
                  <tr><th>自有資金 IRR</th>{comparisonItems.map(item => <td className={item.baseline ? 'baseline' : ''} key={item.key}>{Number.isFinite(item.result.leveragedIrr) ? pct(item.result.leveragedIrr) : '無法計算'}</td>)}</tr>
                  <tr className="scenarioActions"><th>計算依據</th>{comparisonItems.map(item => <td className={item.baseline ? 'baseline' : ''} key={item.key}><button onClick={() => showScenarioDetail(item)}><Calculator size={13}/>查看</button></td>)}</tr>
                </tbody>
              </table>
            </div>
          </details>
        </article>

        <article className="panel controls">
          <div className="panelTitle"><div><p className="eyebrow">LIVE SCENARIO</p><h2>成交價情境</h2></div><SlidersHorizontal size={20}/></div>
          <label className="priceInput"><span>預估成交價</span><div><input aria-label="預估成交價" type="number" min="0" step="10000" placeholder="直接輸入金額" value={inputs.salePrice || ''} onChange={event => updateScenarioNumber('salePrice', event.target.value === '' ? 0 : Number(event.target.value))}/></div></label>
          <div className="savedFact"><span>成交單價採用坪數</span><strong>{activeProperty.houseAreaPing > 0 ? `${activeProperty.houseAreaPing} 坪` : '尚未設定'}</strong></div>
          <div className="unitPriceResult">
            <span>自動換算每坪單價</span>
            <strong>{activeProperty.houseAreaPing > 0 ? `${nt(inputs.salePrice / activeProperty.houseAreaPing)}／坪` : '請至基本資料輸入坪數'}</strong>
          </div>
          <div className="savedFact"><span>購入成交日</span><strong>{activeProperty.purchaseDate}</strong></div>
          <DateField label="出售成交日" value={inputs.saleDate} min={activeProperty.mortgageDataDate} onChange={updateSaleDate} />
          <div className="holdingPeriod"><span>自動計算持有期間</span><strong>{money(result.holdingDays)} 天・{result.holdingYears.toFixed(3)} 年</strong></div>
          <Field label="出售仲介費率" value={inputs.sellingAgencyFeeRate} suffix="%" step={0.1} onChange={v => updateScenarioNumber('sellingAgencyFeeRate', v)} />
          <div className="sellingCosts">
            <div className="sellingCostsHeader">
              <div><span>其他出售成本</span><strong>{nt(result.otherSellingCosts)}</strong></div>
              <button type="button" onClick={addSellingCost}><Plus size={14}/>新增</button>
            </div>
            {scenario.customSellingCosts.length === 0 && <p>目前沒有其他固定費用</p>}
            {scenario.customSellingCosts.map(cost => <div className="sellingCostRow" key={cost.id}>
              <label><span>費用名稱</span><input aria-label="出售成本名稱" placeholder="例如：代書費、清潔費" value={cost.name} onChange={event => updateSellingCost(cost.id, { name: event.target.value })} /></label>
              <label><span>金額</span><div><input aria-label={`${cost.name || '出售成本'}金額`} type="number" min="0" placeholder="0" value={cost.amount || ''} onChange={event => updateSellingCost(cost.id, { amount: event.target.value === '' ? 0 : Number(event.target.value) })} /></div></label>
              <label className="sellingCostEvidence"><input type="checkbox" checked={cost.documented} onChange={event => updateSellingCost(cost.id, { documented: event.target.checked })}/><span>有可申報憑證</span></label>
              <button type="button" aria-label={`刪除${cost.name || '出售成本'}`} onClick={() => removeSellingCost(cost.id)}><Trash2 size={13}/></button>
            </div>)}
            <div className="sellingCostTotal"><span>出售成本合計</span><strong>{nt(result.saleCosts)}</strong></div>
          </div>
        </article>
      </section>

      {detail && <CalculationDrawer detail={detail} onClose={() => setDetail(null)} />}
      {editingProperty && <PropertyEditor profile={editingProperty} saleDate={scenario.saleDate} onChange={updateAndPersistProfile} onClose={() => setEditingProperty(null)} />}
    </main>
  </div>
}

function Card({ label, value, note, onClick }: { label: string; value: string; note: string; onClick: () => void }) {
  return <button className="card" onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{note}</small><em><Calculator size={13}/>查看計算</em></button>
}

function Metric({ label, value, note, onClick }: { label: string; value: string; note: string; onClick: () => void }) {
  return <button className="metric" onClick={onClick}><span>{label}</span><strong>{value}</strong><p>{note}</p><em><Calculator size={13}/>查看計算</em></button>
}

function CalculationDrawer({ detail, onClose }: { detail: CalculationDetail; onClose: () => void }) {
  return <div className="drawerBackdrop" role="presentation" onMouseDown={onClose}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${detail.title}計算依據`} onMouseDown={event => event.stopPropagation()}>
      <div className="drawerHeader"><div><p className="eyebrow">CALCULATION EVIDENCE</p><h2>{detail.title}</h2></div><button aria-label="關閉計算依據" onClick={onClose}><X size={20}/></button></div>
      <div className="drawerResult"><span>目前結果</span><strong>{detail.result}</strong></div>
      <p className="drawerSummary">{detail.summary}</p>
      <div className="formula"><span>公式</span><code>{detail.formula}</code></div>
      <div className="calculationRows">
        {detail.rows.map((row, index) => row.children
          ? <details className="calculationGroup" key={`${row.label}-${index}`}>
              <summary><i>{row.operator ?? ''}</i><span>{row.label}<small>{row.children.length > 0 ? '點擊展開明細' : '尚未輸入項目'}</small></span><strong>{row.value}</strong></summary>
              {row.children.length > 0 && <div>{row.children.map((child, childIndex) => <p key={`${child.label}-${childIndex}`}><span>{child.label}</span><strong>{child.value}</strong></p>)}</div>}
            </details>
          : <div className={row.operator === '=' ? 'total' : ''} key={`${row.label}-${index}`}>
              <i>{row.operator ?? ''}</i>
              <span>
                {row.noteAbove && <small className="calculationSourceNote">{row.noteAbove}</small>}
                {row.label}
              </span>
              <strong>{row.value}</strong>
            </div>)}
      </div>
      {detail.note && <div className="caveat"><b>範圍與限制</b><p>{detail.note}</p></div>}
    </aside>
  </div>
}

function PropertyEditor({ profile, saleDate, onChange, onClose }: { profile: PropertyProfile; saleDate: string; onChange: (profile: PropertyProfile) => void; onClose: () => void }) {
  const [recognizing, setRecognizing] = useState(false)
  const [landLookupStatus, setLandLookupStatus] = useState<Record<string, { state: 'loading' | 'success' | 'error'; message: string }>>({})
  const [cpiLookupStatus, setCpiLookupStatus] = useState<Record<string, { state: 'loading' | 'success' | 'error'; message: string }>>({})
  const updateText = (key: 'name' | 'address' | 'purchaseDate' | 'mortgageDataDate', value: string) =>
    onChange({ ...profile, [key]: value })
  const updateNumber = (key: 'purchasePrice' | 'originalLoan' | 'currentLoanBalance' | 'totalMortgagePaymentsPaid' | 'paymentEstimateAnnualRate' | 'originalLoanTermYears' | 'annualRate' | 'remainingLoanYears' | 'currentMarketValue' | 'houseAreaPing' | 'mortgagePaymentDay', value: number) =>
    onChange({ ...profile, [key]: value })
  const updateCost = (key: keyof PropertyProfile['acquisitionCosts'], value: number) =>
    onChange({ ...profile, acquisitionCosts: { ...profile.acquisitionCosts, [key]: value } })
  const updateTaxProfile = (changes: Partial<PropertyProfile['taxProfile']>) =>
    onChange({ ...profile, taxProfile: { ...profile.taxProfile, ...changes } })
  const addLandParcel = () => updateTaxProfile({
    landPriceIncrementParcels: [
      ...profile.taxProfile.landPriceIncrementParcels,
      {
        id: crypto.randomUUID(),
        name: `土地 ${profile.taxProfile.landPriceIncrementParcels.length + 1}`,
        currentDeclaredValuePerSquareMeter: null,
        previousDeclaredValuePerSquareMeter: null,
        cpiAdjustmentPercent: null,
        areaSquareMeters: null,
        ownershipNumerator: 1,
        ownershipDenominator: 1,
        improvementCosts: 0,
        officialCityCode: '',
        officialSectionCode: '',
        officialLandNumber: '',
        previousTransferDateMode: 'purchase-date',
        previousTransferYearMonth: '',
      },
    ],
  })
  const updateLandParcel = (
    id: string,
    changes: Partial<LandPriceIncrementParcel>,
  ) => updateTaxProfile({
    landPriceIncrementParcels:
      profile.taxProfile.landPriceIncrementParcels.map(parcel =>
        parcel.id === id ? { ...parcel, ...changes } : parcel
      ),
  })
  const removeLandParcel = (id: string) => updateTaxProfile({
    landPriceIncrementParcels:
      profile.taxProfile.landPriceIncrementParcels.filter(parcel =>
        parcel.id !== id
      ),
  })
  const lookupOfficialLandValue = async (parcel: LandPriceIncrementParcel) => {
    setLandLookupStatus(current => ({
      ...current,
      [parcel.id]: { state: 'loading', message: '正在查詢內政部資料…' },
    }))
    try {
      const cityCode = parcel.officialCityCode ||
        inferCityCode(parcel.name)
      const parsedLandNumber = extractLandNumber(
        parcel.officialLandNumber || parcel.name,
      )
      const sectionCode = parcel.officialSectionCode ||
        await fetchOfficialSectionCode(
          parcel.name,
          cityCode,
        )
      const official = await fetchOfficialLandValue(
        cityCode,
        sectionCode,
        parsedLandNumber,
      )
      updateLandParcel(parcel.id, {
        currentDeclaredValuePerSquareMeter: official.announcedCurrentValue,
        officialCityCode: cityCode,
        officialSectionCode: sectionCode,
        officialLandNumber: official.landNumber,
        officialLookupAt: new Date().toISOString(),
        officialProvider: official.provider,
      })
      setLandLookupStatus(current => ({
        ...current,
        [parcel.id]: {
          state: 'success',
          message: `已解析段碼 ${sectionCode}、地號 ${parsedLandNumber}，並帶入每平方公尺 ${nt(official.announcedCurrentValue)}；來源：${official.provider}`,
        },
      }))
    } catch (error) {
      setLandLookupStatus(current => ({
        ...current,
        [parcel.id]: {
          state: 'error',
          message: error instanceof Error ? error.message : '官方資料查詢失敗',
        },
      }))
    }
  }
  const lookupTaxCpi = async (
    parcel: LandPriceIncrementParcel,
    mode: 'purchase-date' | 'manual',
  ) => {
    const baseYearMonth = mode === 'purchase-date'
      ? profile.purchaseDate.slice(0, 7)
      : parcel.previousTransferYearMonth ?? ''
    updateLandParcel(parcel.id, { previousTransferDateMode: mode })
    setCpiLookupStatus(current => ({
      ...current,
      [parcel.id]: { state: 'loading', message: '正在查詢主計總處資料…' },
    }))
    try {
      const result = await fetchTaxCpi(baseYearMonth, saleDate.slice(0, 7))
      updateLandParcel(parcel.id, {
        previousTransferDateMode: mode,
        cpiAdjustmentPercent: result.adjustmentPercent,
        cpiLookupAt: new Date().toISOString(),
        cpiReferenceYearMonth: result.referenceYearMonth,
        cpiProvider: result.provider,
      })
      setCpiLookupStatus(current => ({
        ...current,
        [parcel.id]: {
          state: 'success',
          message: `已依 ${result.baseYearMonth} 計算為 ${result.adjustmentPercent}%；官方資料截至 ${result.referenceYearMonth}`,
        },
      }))
    } catch (error) {
      setCpiLookupStatus(current => ({
        ...current,
        [parcel.id]: {
          state: 'error',
          message: error instanceof Error ? error.message : '物價指數查詢失敗',
        },
      }))
    }
  }
  const addCustomCost = () => onChange({
    ...profile,
    customAcquisitionCosts: [
      ...profile.customAcquisitionCosts,
      { id: crypto.randomUUID(), name: '', amount: 0 },
    ],
  })
  const updateCustomCost = (id: string, changes: { name?: string; amount?: number }) =>
    onChange({
      ...profile,
      customAcquisitionCosts: profile.customAcquisitionCosts.map(cost =>
        cost.id === id ? { ...cost, ...changes } : cost),
    })
  const removeCustomCost = (id: string) => {
    const next = {
      ...profile,
      customAcquisitionCosts: profile.customAcquisitionCosts.filter(cost => cost.id !== id),
    }
    onChange(next)
  }
  const acquisitionCostTotal = totalAcquisitionCosts(
    profile.acquisitionCosts,
    profile.customAcquisitionCosts,
  )
  const estimatedPaidMonths = profile.mortgageDataDate > profile.purchaseDate
    ? calculateHoldingPeriod(profile.purchaseDate, profile.mortgageDataDate).months
    : 0
  const estimatedMonthlyPayment = mortgagePayment(
    profile.originalLoan,
    profile.paymentEstimateAnnualRate,
    profile.originalLoanTermYears,
  )
  const landEstimateComplete =
    profile.taxProfile.landPriceIncrementParcels.length > 0 &&
    profile.taxProfile.landPriceIncrementParcels.every(parcel =>
      parcel.currentDeclaredValuePerSquareMeter !== null &&
      parcel.previousDeclaredValuePerSquareMeter !== null &&
      parcel.cpiAdjustmentPercent !== null &&
      parcel.areaSquareMeters !== null &&
      parcel.ownershipDenominator > 0
    )
  const estimatedLandPriceIncrementTotal = estimateLandPriceIncrementTotal(
    profile.taxProfile.landPriceIncrementParcels,
  )

  return <div className="drawerBackdrop" role="presentation" onMouseDown={onClose}>
    <aside className="drawer propertyEditor" role="dialog" aria-modal="true" aria-label="房屋基本資料" onMouseDown={event => event.stopPropagation()}>
      <div className="drawerHeader"><div><p className="eyebrow">PROPERTY DATABASE</p><h2>房屋基本資料</h2></div><button aria-label="關閉房屋基本資料" onClick={onClose}><X size={20}/></button></div>
      <p className="drawerSummary">儲存後，Dashboard、出售分析、CAGR 與 IRR 都會共用這份資料。</p>
      <button className="openRecognition" type="button" onClick={() => setRecognizing(true)}><Camera size={17}/>免費從多張文件照片帶入</button>
      <form onSubmit={event => event.preventDefault()}>
        <EditorSection title="識別資料">
          <TextInput label="房屋名稱" value={profile.name} onChange={value => updateText('name', value)} required />
          <TextInput label="地址或備註" value={profile.address} onChange={value => updateText('address', value)} />
          <TextInput label="購入成交日" type="date" value={profile.purchaseDate} onChange={value => updateText('purchaseDate', value)} required />
          <NumberInput label="目前預估市值" value={profile.currentMarketValue} onChange={value => updateNumber('currentMarketValue', value)} />
          <NumberInput label="成交單價採用坪數" help="用來把成交價換算成每坪單價。請填你比較市場行情時採用的權狀或計價坪數；不會影響土地謄本面積與持分。" value={profile.houseAreaPing} suffix="坪" step={0.01} onChange={value => updateNumber('houseAreaPing', value)} />
        </EditorSection>
        <EditorSection title="購入價格與相關成本">
          <NumberInput label="購入價格" value={profile.purchasePrice} onChange={value => updateNumber('purchasePrice', value)} />
          <NumberInput label="契稅" value={profile.acquisitionCosts.deedTax} onChange={value => updateCost('deedTax', value)} />
          <NumberInput label="印花稅" value={profile.acquisitionCosts.stampTax} onChange={value => updateCost('stampTax', value)} />
          <NumberInput label="登記與規費" value={profile.acquisitionCosts.registrationFees} onChange={value => updateCost('registrationFees', value)} />
          <NumberInput label="購入仲介費" value={profile.acquisitionCosts.agencyFee} onChange={value => updateCost('agencyFee', value)} />
          <NumberInput label="代書費" value={profile.acquisitionCosts.legalFee} onChange={value => updateCost('legalFee', value)} />
          <div className="customCosts">
            <div className="customCostsHeader"><span>自訂取得成本</span><button type="button" onClick={addCustomCost}><Plus size={14}/>新增一筆</button></div>
            {profile.customAcquisitionCosts.length === 0 && <p>尚未新增自訂項目</p>}
            {profile.customAcquisitionCosts.map(cost => <div className="customCostRow" key={cost.id}>
              <input aria-label="自訂成本名稱" placeholder="例如：履約保證費" value={cost.name} onChange={event => updateCustomCost(cost.id, { name: event.target.value })}/>
              <div><input aria-label={`${cost.name || '自訂成本'}金額`} type="number" min="0" placeholder="0" value={cost.amount || ''} onChange={event => updateCustomCost(cost.id, { amount: event.target.value === '' ? 0 : Number(event.target.value) })}/></div>
              <button type="button" aria-label={`刪除${cost.name || '自訂成本'}`} onClick={() => removeCustomCost(cost.id)}><Trash2 size={14}/></button>
            </div>)}
          </div>
          <div className="editorTotal"><span>購入相關成本合計</span><strong>{nt(acquisitionCostTotal)}</strong></div>
        </EditorSection>
        <EditorSection title="貸款資料">
          <NumberInput label="原始貸款金額" value={profile.originalLoan} onChange={value => updateNumber('originalLoan', value)} />
          <NumberInput label="目前銀行貸款餘額" value={profile.currentLoanBalance} onChange={value => updateNumber('currentLoanBalance', value)} />
          <TextInput label="貸款資料截至日" type="date" value={profile.mortgageDataDate} onChange={value => updateText('mortgageDataDate', value)} required />
          <NumberInput label="每月房貸扣款日" help="用來計算貸款資料截至日至預計出售日之間，實際會經過幾次房貸扣款日。若填31日，沒有31日的月份以月底計算。" value={profile.mortgagePaymentDay} suffix="日" min={1} max={31} onChange={value => updateNumber('mortgagePaymentDay', value)} />
          <div className="paymentMode">
            <span>累積房貸付款輸入方法</span>
            <div>
              <button type="button" className={profile.mortgagePaymentMode === 'actual' ? 'active' : ''} onClick={() => onChange({ ...profile, mortgagePaymentMode: 'actual' })}>實際金額</button>
              <button type="button" className={profile.mortgagePaymentMode === 'estimated' ? 'active' : ''} onClick={() => onChange({ ...profile, mortgagePaymentMode: 'estimated' })}>公式推估</button>
            </div>
          </div>
          {profile.mortgagePaymentMode === 'actual'
            ? <NumberInput label="已支付房貸總額（本金＋利息）" value={profile.totalMortgagePaymentsPaid} onChange={value => updateNumber('totalMortgagePaymentsPaid', value)} />
            : <>
              <NumberInput label="持有期間推估平均利率" value={profile.paymentEstimateAnnualRate} step={0.01} suffix="%" onChange={value => updateNumber('paymentEstimateAnnualRate', value)} />
              <NumberInput label="原始貸款年限" value={profile.originalLoanTermYears} suffix="年" onChange={value => updateNumber('originalLoanTermYears', value)} />
              <div className="estimateResult">
                <span>推估公式</span>
                <code>月付金 × 購入至資料截至日期數</code>
                <div><span>推估月付</span><strong>{nt(estimatedMonthlyPayment)}</strong></div>
                <div><span>推估期數</span><strong>{estimatedPaidMonths} 期</strong></div>
                <div><span>截至日累積付款推估</span><strong>{nt(estimatedMonthlyPayment * estimatedPaidMonths)}</strong></div>
                <p>採本息平均攤還假設；利率變動、寬限期與提前還款會造成差異。</p>
              </div>
            </>}
          <NumberInput label="目前房貸利率" value={profile.annualRate} step={0.01} suffix="%" onChange={value => updateNumber('annualRate', value)} />
          <NumberInput label="剩餘貸款年限" value={profile.remainingLoanYears} suffix="年" onChange={value => updateNumber('remainingLoanYears', value)} />
        </EditorSection>
        <EditorSection title="賣房稅務資料">
          <div className="taxNotice">取得日會用來判定新舊制；持有期間與適用稅率會依情境中的出售日自動判定。</div>
          <SelectInput label="納稅人身分" help="依出售年度是否屬中華民國境內居住者判定。非境內居住者適用的持有期間級距不同；不確定時應依實際居留情況確認。" value={profile.taxProfile.residency} onChange={value => updateTaxProfile({ residency: value as PropertyProfile['taxProfile']['residency'] })}>
            <option value="resident">中華民國境內居住者</option>
            <option value="nonresident">非境內居住者</option>
          </SelectInput>
          <div className="taxNotice">出售費用會自動比較實際憑證合計與法定推計額（成交價3%，最高30萬元），採用較高者；不用手動選擇。</div>
          <NumberInput label="前3年可扣抵房地交易損失" help="填入其他新制房地交易在本次交易日前3年內、經國稅局核定且尚未扣完的損失。沒有核定通知書時填0。" value={profile.taxProfile.priorThreeYearTransactionLoss} onChange={value => updateTaxProfile({ priorThreeYearTransactionLoss: value })} />
          <NullableNumberInput label="土地漲價總數額" help="取自土地增值稅繳款書或免稅證明書，用來自房地交易所得中減除。這不是土地增值稅稅額；未知時保持空白。" value={profile.taxProfile.landPriceIncrementTotal} onChange={value => updateTaxProfile({ landPriceIncrementTotal: value, landPriceIncrementSource: 'manual' })} />
          {profile.taxProfile.landPriceIncrementSource === 'estimate' &&
            <div className="appliedEstimateStatus">已套用財政部試算欄預估</div>}
          <details className="landEstimator">
            <summary><span>用財政部試算欄位預估</span><small>可新增多筆地號</small></summary>
            <div className="landEstimatorBody">
              <div className="landEstimatorIntro">
                <p>預估公式：申報移轉現值－物價調整後前次移轉現值－土地改良費用</p>
                <a href="https://www.etax.nat.gov.tw/etwmain/etw158w/51?ccms_cs=1" target="_blank" rel="noreferrer">開啟財政部土地增值稅試算</a>
              </div>
              {profile.taxProfile.landPriceIncrementParcels.map(parcel => {
                const parcelEstimate = estimateLandPriceIncrementTotal([parcel])
                const complete = parcel.currentDeclaredValuePerSquareMeter !== null &&
                  parcel.previousDeclaredValuePerSquareMeter !== null &&
                  parcel.cpiAdjustmentPercent !== null &&
                  parcel.areaSquareMeters !== null &&
                  parcel.ownershipDenominator > 0
                return <section className="landParcel" key={parcel.id}>
                  <div className="landParcelHeader"><strong>{parcel.name || '未命名土地'}</strong><button type="button" aria-label={`刪除${parcel.name || '土地'}`} onClick={() => removeLandParcel(parcel.id)}><Trash2 size={13}/></button></div>
                  <TextInput label="地號或名稱" value={parcel.name} onChange={value => updateLandParcel(parcel.id, { name: value })} />
                  <div className="officialLookup">
                    <p>官方公告土地現值</p>
                    <SelectInput label="縣市" value={parcel.officialCityCode ?? ''} onChange={value => updateLandParcel(parcel.id, { officialCityCode: value })}>
                      <option value="">請選擇</option>
                      {landCityOptions.map(([code, name]) => <option value={code} key={code}>{name}</option>)}
                    </SelectInput>
                    <TextInput label="段小段代碼" help="內政部API使用4碼段小段代碼，不是段名。可由土地謄本或政府土地段名代碼資料查得。" value={parcel.officialSectionCode ?? ''} onChange={value => updateLandParcel(parcel.id, { officialSectionCode: value.replace(/\D/g, '').slice(0, 4) })} />
                    <a className="sectionCodeLink" href="https://data.gov.tw/dataset/122674" target="_blank" rel="noreferrer">查詢官方土地段名代碼</a>
                    <TextInput label="地號" help="可輸入427或427-13；系統會自動轉為官方母號、子號各4碼格式。" value={parcel.officialLandNumber ?? ''} onChange={value => updateLandParcel(parcel.id, { officialLandNumber: value })} />
                    <button type="button" disabled={landLookupStatus[parcel.id]?.state === 'loading'} onClick={() => lookupOfficialLandValue(parcel)}>解析完整地號並查官方資料</button>
                    {landLookupStatus[parcel.id] && <div className={`lookupStatus ${landLookupStatus[parcel.id].state}`}>{landLookupStatus[parcel.id].message}</div>}
                    {parcel.officialLookupAt && <small>上次查詢：{new Date(parcel.officialLookupAt).toLocaleString('zh-TW')}</small>}
                  </div>
                  <NullableNumberInput label="本次公告／申報現值（每平方公尺）" help="填本次移轉採用的土地公告現值或經核定的申報移轉現值單價。" value={parcel.currentDeclaredValuePerSquareMeter} onChange={value => updateLandParcel(parcel.id, { currentDeclaredValuePerSquareMeter: value })} />
                  <div className="transferDateMode">
                    <span>前次移轉年月輸入方式</span>
                    <div>
                      <button type="button" disabled={cpiLookupStatus[parcel.id]?.state === 'loading'} className={(parcel.previousTransferDateMode ?? 'purchase-date') === 'purchase-date' ? 'active' : ''} onClick={() => lookupTaxCpi(parcel, 'purchase-date')}>帶入購入成交日</button>
                      <button type="button" className={parcel.previousTransferDateMode === 'manual' ? 'active' : ''} onClick={() => updateLandParcel(parcel.id, { previousTransferDateMode: 'manual' })}>手動輸入</button>
                    </div>
                  </div>
                  {(parcel.previousTransferDateMode ?? 'purchase-date') === 'purchase-date'
                    ? <div className="savedFact"><span>目前採用年月</span><strong>{profile.purchaseDate.slice(0, 7) || '尚未設定購入成交日'}</strong></div>
                    : <>
                      <TextInput label="前次移轉年月" help="請依土地謄本、土地增值稅繳款書或免稅證明書記載的年月輸入。" type="month" value={parcel.previousTransferYearMonth ?? ''} onChange={value => updateLandParcel(parcel.id, { previousTransferYearMonth: value })} />
                      <button className="lookupCpiButton" type="button" disabled={cpiLookupStatus[parcel.id]?.state === 'loading'} onClick={() => lookupTaxCpi(parcel, 'manual')}>依手動年月查詢物價指數</button>
                    </>}
                  <NullableNumberInput label="原規定地價或前次移轉現值（每平方公尺）" help="可從土地謄本、前次移轉資料或地方稅捐機關取得。" value={parcel.previousDeclaredValuePerSquareMeter} onChange={value => updateLandParcel(parcel.id, { previousDeclaredValuePerSquareMeter: value })} />
                  <NullableNumberInput label="稅務專用物價指數" help="以百分比輸入，例如120代表120%；請使用財政部試算所連結的稅務專用消費者物價總指數。" value={parcel.cpiAdjustmentPercent} suffix="%" step={0.01} onChange={value => updateLandParcel(parcel.id, { cpiAdjustmentPercent: value })} />
                  {cpiLookupStatus[parcel.id] && <div className={`lookupStatus ${cpiLookupStatus[parcel.id].state}`}>{cpiLookupStatus[parcel.id].message}</div>}
                  {parcel.cpiLookupAt && <small>物價資料來源：{parcel.cpiProvider}・基準資料月份 {parcel.cpiReferenceYearMonth}・查詢時間 {new Date(parcel.cpiLookupAt).toLocaleString('zh-TW')}</small>}
                  <NullableNumberInput label="土地宗地面積" help="填土地登記謄本標示的整筆宗地面積，再由下方持分換算你出售的部分。" value={parcel.areaSquareMeters} suffix="㎡" step={0.01} onChange={value => updateLandParcel(parcel.id, { areaSquareMeters: value })} />
                  <div className="ownershipFields">
                    <NumberInput label="持分分子" value={parcel.ownershipNumerator} onChange={value => updateLandParcel(parcel.id, { ownershipNumerator: value })} />
                    <NumberInput label="持分分母" value={parcel.ownershipDenominator} onChange={value => updateLandParcel(parcel.id, { ownershipDenominator: value })} />
                  </div>
                  <NumberInput label="核准土地改良費用" help="僅填地方稅捐機關核准減除的工程受益費、重劃費用等土地改良費用。" value={parcel.improvementCosts} onChange={value => updateLandParcel(parcel.id, { improvementCosts: value })} />
                  <div className="parcelEstimate"><span>本筆預估</span><strong>{complete ? nt(parcelEstimate) : '資料未齊'}</strong></div>
                </section>
              })}
              <button className="addLandParcel" type="button" onClick={addLandParcel}><Plus size={14}/>新增一筆土地</button>
              <div className="landEstimateTotal"><span>預估土地漲價總數額合計</span><strong>{landEstimateComplete ? nt(estimatedLandPriceIncrementTotal) : '資料未齊'}</strong></div>
              <button
                className="applyLandEstimate"
                type="button"
                disabled={!landEstimateComplete}
                onClick={event => {
                  updateTaxProfile({
                    landPriceIncrementTotal: estimatedLandPriceIncrementTotal,
                    landPriceIncrementSource: 'estimate',
                  })
                  const estimator = event.currentTarget.closest('details')
                  if (estimator instanceof HTMLDetailsElement) estimator.open = false
                }}
              >
                套用預估合計
              </button>
              <p className="estimateCaveat">此為規劃用預估；正式申報仍以土地增值稅繳款書或免稅證明書核定金額為準。</p>
            </div>
          </details>
          <NullableNumberInput label="土地增值稅核定／官方試算額" help="出售土地時另行課徵的地方稅。請填地方稅機關核定或官方試算結果，無法只用房地成交價推算；未知時保持空白。" value={profile.taxProfile.landValueIncrementTax} onChange={value => updateTaxProfile({ landValueIncrementTax: value })} />
          <NumberInput label="可列費用的土地增值稅部分" help="土地增值稅通常不得全額再列費用；只有符合規定的未減除土地漲價總數額所對應部分才可列入。沒有稅務文件確認時填0。" value={profile.taxProfile.deductibleLandValueIncrementTax} onChange={value => updateTaxProfile({ deductibleLandValueIncrementTax: value })} />
          <CheckInput label="準備申請自住房地優惠" help="只有同時符合設籍居住、6年內未出租營業，以及家庭前6年未使用過優惠等條件，才可適用400萬元免稅額及超過部分10%。" checked={profile.taxProfile.claimsSelfUseBenefit} onChange={checked => updateTaxProfile({ claimsSelfUseBenefit: checked })} />
          {profile.taxProfile.claimsSelfUseBenefit && <div className="taxQualifications">
            <TextInput label="本人、配偶或未成年子女設籍日期" help="請依戶口名簿或戶籍謄本填寫在本房屋辦竣戶籍登記的日期。系統會從此日期計算連續滿6年的最早日期。" type="date" min={profile.purchaseDate} value={profile.taxProfile.householdRegistrationDate ?? ''} onChange={value => updateTaxProfile({ householdRegistrationDate: value || null })} />
            {profile.taxProfile.householdRegistrationDate && <div className="selfUseEligibility"><span>設籍連續滿 6 年日期</span><strong>{addYears(profile.taxProfile.householdRegistrationDate, 6)}</strong><small>{saleDate >= addYears(profile.taxProfile.householdRegistrationDate, 6) ? '出售日已達設籍年限；仍須確認持有、實住及其他條件。' : `目前出售日尚差距，最早須於 ${addYears(profile.taxProfile.householdRegistrationDate, 6)} 或之後交易。`}</small></div>}
            <CheckInput label="確認自設籍日起持續實際居住" help="戶籍只是其中一項證明；仍須有連續實際居住事實。系統無法僅由設籍日期自動確認居住狀況。" checked={profile.taxProfile.householdRegisteredAndLivedSixYears} onChange={checked => updateTaxProfile({ householdRegisteredAndLivedSixYears: checked })} />
            <CheckInput label="交易前6年內未出租、營業或執行業務" help="出售日前6年內，該房地不得出租、供營業或執行業務使用；若曾有使用情形，請勿勾選。" checked={profile.taxProfile.noRentalOrBusinessUseSixYears} onChange={checked => updateTaxProfile({ noRentalOrBusinessUseSixYears: checked })} />
            <CheckInput label="本人、配偶及未成年子女前6年未用過此優惠" help="以家庭為單位檢查；本人、配偶與未成年子女在本次交易前6年內都不能曾適用自住房地優惠。" checked={profile.taxProfile.noSelfUseBenefitInPriorSixYears} onChange={checked => updateTaxProfile({ noSelfUseBenefitInPriorSixYears: checked })} />
          </div>}
          <CheckInput label="確認符合財政部公告的非自願性交易資格" help="例如符合公告的調職、非自願離職、重大疾病等特殊原因，且須準備證明文件由稽徵機關認定；不是單純急售即可勾選。" checked={profile.taxProfile.involuntaryTransferEligible} onChange={checked => updateTaxProfile({ involuntaryTransferEligible: checked })} />
          <CheckInput label="準備申請自住房地重購退稅" help="先買後賣或先賣後買均可，但新、舊房地移轉登記日須相距2年內，兩者均須設籍並實際自住，舊屋出售前1年不得出租或營業。" checked={profile.taxProfile.claimsRepurchaseBenefit} onChange={checked => updateTaxProfile({ claimsRepurchaseBenefit: checked })} />
          {profile.taxProfile.claimsRepurchaseBenefit && <div className="taxQualifications repurchase">
            <TextInput label="重購移轉登記日" help="以新房地完成所有權移轉登記日為準；可先買後賣或先賣後買，與舊屋出售登記日須相距2年內。" type="date" value={profile.taxProfile.repurchaseDate ?? ''} onChange={value => updateTaxProfile({ repurchaseDate: value || null })} />
            <NullableNumberInput label="重購房地成交價" help="房地合一所得稅退稅按重購價額占原出售價額的比例計算，最高不超過原已納所得稅。" value={profile.taxProfile.repurchasePrice} onChange={value => updateTaxProfile({ repurchasePrice: value })} />
            <CheckInput label="新、舊房屋均已設籍並實際居住" help="本人、配偶或未成年子女須在新舊自住房屋設籍並有實際居住事實。" checked={profile.taxProfile.oldAndNewHomesRegisteredAndOccupied} onChange={checked => updateTaxProfile({ oldAndNewHomesRegisteredAndOccupied: checked })} />
            <CheckInput label="舊屋出售前1年未出租、營業或執行業務" help="出售日前1年內只要曾出租、供營業或執行業務使用，通常就不符合本項重購優惠。" checked={profile.taxProfile.oldHomeNoRentalOrBusinessOneYear} onChange={checked => updateTaxProfile({ oldHomeNoRentalOrBusinessOneYear: checked })} />
            <CheckInput label="了解新屋5年內改作他用或移轉會被追繳" help="重購後5年內若未設籍居住、出租、營業或再次移轉，原扣抵或退還的稅額可能被追繳。" checked={profile.taxProfile.acknowledgesFiveYearClawback} onChange={checked => updateTaxProfile({ acknowledgesFiveYearClawback: checked })} />
            <CheckInput label="同時計算土地增值稅重購退稅" help="此項與房地合一所得稅退稅不同，必須使用新舊土地申報移轉現值，而且出售與重購土地所有權人須相同。" checked={profile.taxProfile.claimsLandValueRepurchaseRefund} onChange={checked => updateTaxProfile({ claimsLandValueRepurchaseRefund: checked })} />
            {profile.taxProfile.claimsLandValueRepurchaseRefund && <>
              <NullableNumberInput label="原出售土地申報移轉現值" help="填土地增值稅申報資料上的出售土地申報移轉現值，不是房地成交總價。" value={profile.taxProfile.soldLandDeclaredValue} onChange={value => updateTaxProfile({ soldLandDeclaredValue: value })} />
              <NullableNumberInput label="新購土地申報移轉現值" help="填重購土地申報移轉現值；土地增值稅重購退稅的大小換屋比較以此數字計算。" value={profile.taxProfile.repurchasedLandDeclaredValue} onChange={value => updateTaxProfile({ repurchasedLandDeclaredValue: value })} />
              <CheckInput label="出售與重購土地為同一所有權人" help="土地增值稅重購退稅要求新舊土地所有權人相同；僅以配偶另一方名義重購土地通常不符合。" checked={profile.taxProfile.sameLandOwner} onChange={checked => updateTaxProfile({ sameLandOwner: checked })} />
            </>}
          </div>}
          <div className="taxNotice warning">土地增值稅請優先填入地方稅機關核定或官方試算結果；房地成交價無法可靠推回公告土地現值。</div>
        </EditorSection>
        <div className="storageNote autoSaveNote">
          <strong>已開啟自動儲存與套用</strong>
          <span>每次修改欄位都會立即套用；資料只儲存在這台裝置的此瀏覽器中。</span>
        </div>
      </form>
      {recognizing && <DocumentRecognition profile={profile} onApply={next => { onChange(next); setRecognizing(false) }} onClose={() => setRecognizing(false)} />}
    </aside>
  </div>
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="editorSection"><h3>{title}</h3>{children}</section>
}

function TextInput({ label, value, help, type = 'text', min, required = false, onChange }: { label: string; value: string; help?: string; type?: string; min?: string; required?: boolean; onChange: (value: string) => void }) {
  return <label className="editorField"><span>{label}{help && <HelpTip text={help} />}</span><input type={type} min={min} value={value} required={required} onChange={event => onChange(event.target.value)} /></label>
}

function NumberInput({ label, value, help, suffix = '', step = 1, min = 0, max, onChange }: { label: string; value: number; help?: string; suffix?: string; step?: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="editorField"><span>{label}{help && <HelpTip text={help} />}</span><div><input type="number" min={min} max={max} step={step} placeholder="0" value={value || ''} onChange={event => onChange(event.target.value === '' ? 0 : Number(event.target.value))} />{suffix && <em>{suffix}</em>}</div></label>
}

function NullableNumberInput({ label, value, help, suffix = '', step = 1, onChange }: { label: string; value: number | null; help?: string; suffix?: string; step?: number; onChange: (value: number | null) => void }) {
  return <label className="editorField"><span>{label}{help && <HelpTip text={help} />}</span><div><input type="number" min="0" step={step} placeholder="尚未填寫" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))} />{suffix && <em>{suffix}</em>}</div></label>
}

function SelectInput({ label, value, help, children, onChange }: { label: string; value: string; help?: string; children: ReactNode; onChange: (value: string) => void }) {
  return <label className="editorField"><span>{label}{help && <HelpTip text={help} />}</span><select value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>
}

function CheckInput({ label, checked, help, onChange }: { label: string; checked: boolean; help?: string; onChange: (checked: boolean) => void }) {
  return <label className="checkField"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}{help && <HelpTip text={help} />}</span></label>
}

function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return <span className="helpTip">
    <button type="button" aria-label="查看欄位說明" aria-expanded={open} onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(current => !current) }}><CircleHelp size={14}/></button>
    {open && <span role="tooltip">{text}</span>}
  </span>
}

function Field({ label, value, suffix, step = 1, onChange }: { label: string; value: number; suffix: string; step?: number; onChange: (v: number) => void }) {
  return <label className="field"><span>{label}</span><div><input type="number" value={value} step={step} onChange={e => onChange(Number(e.target.value))}/><em>{suffix}</em></div></label>
}

function DateField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (v: string) => void }) {
  return <label className="field dateField"><span>{label}</span><input type="date" value={value} min={min} max={max} onChange={e => onChange(e.target.value)}/></label>
}

export default App
