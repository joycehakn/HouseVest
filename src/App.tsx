import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Building2, Calculator, Camera, HousePlus, Landmark, LineChart, Pencil, PiggyBank, Plus, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
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

type ScenarioInputs = {
  salePrice: number
  sellingAgencyFeeRate: number
  customSellingCosts: { id: string; name: string; amount: number }[]
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
  rows: { label: string; value: string; operator?: string }[]
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
  const inputs = useMemo<Inputs>(() => ({
    purchasePrice: activeProperty.purchasePrice,
    acquisitionCosts: totalAcquisitionCosts(
      activeProperty.acquisitionCosts,
      activeProperty.customAcquisitionCosts,
    ),
    originalLoan: activeProperty.originalLoan,
    currentLoanBalance: activeProperty.currentLoanBalance,
    mortgageDataDate: activeProperty.mortgageDataDate,
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
    taxProfile: activeProperty.taxProfile,
    saleDate: scenario.saleDate,
  }), [activeProperty, scenario])
  const result = useMemo(() => calculatePropertyAnalysis(inputs), [inputs])
  const enteredAcquisitionCosts = useMemo(() => [
    { label: '契稅', value: activeProperty.acquisitionCosts.deedTax },
    { label: '印花稅', value: activeProperty.acquisitionCosts.stampTax },
    { label: '登記與規費', value: activeProperty.acquisitionCosts.registrationFees },
    { label: '購入仲介費', value: activeProperty.acquisitionCosts.agencyFee },
    { label: '代書費', value: activeProperty.acquisitionCosts.legalFee },
    ...activeProperty.customAcquisitionCosts.map(cost => ({
      label: cost.name.trim() || '自訂取得成本',
      value: cost.amount,
    })),
  ].filter(cost => cost.value > 0), [activeProperty])
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
        { label: '房地交易所得稅', value: nt(result.taxAnalysis.houseLandIncomeTax ?? 0), operator: '−' },
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
      formula: '課稅所得 = 交易所得 − 前3年交易損失 − 土地漲價總數額；總稅費 = 房地交易所得稅 + 土地增值稅',
      rows: [
        { label: '預估成交價', value: nt(inputs.salePrice) },
        { label: '購入價格', value: nt(inputs.purchasePrice), operator: '−' },
        ...(enteredAcquisitionCosts.length > 0
          ? enteredAcquisitionCosts.map(cost => ({
              label: `取得成本：${cost.label}`,
              value: nt(cost.value),
            }))
          : [{ label: '取得成本明細', value: '尚未輸入任何項目' }]),
        { label: '可辨識取得成本合計', value: nt(inputs.acquisitionCosts), operator: '−' },
        { label: `稅法認列出售費用（${inputs.taxProfile.sellingExpenseMethod === 'documented' ? '憑證' : '法定推計'}）`, value: nt(result.taxAnalysis.recognizedSellingExpenses), operator: '−' },
        { label: '交易所得', value: nt(result.taxAnalysis.transactionIncome), operator: '=' },
        { label: '前3年房地交易損失', value: nt(inputs.taxProfile.priorThreeYearTransactionLoss), operator: '−' },
        { label: '土地漲價總數額', value: inputs.taxProfile.landPriceIncrementTotal === null ? '尚未填寫' : nt(inputs.taxProfile.landPriceIncrementTotal), operator: '−' },
        { label: '課稅所得', value: nt(result.taxAnalysis.taxableIncome), operator: '=' },
        ...(result.taxAnalysis.selfUseQualified ? [{ label: '自住房地免稅額', value: nt(result.taxAnalysis.selfUseExemption), operator: '−' }] : []),
        { label: `適用稅率 ${result.taxAnalysis.appliedRate ?? '—'}%`, value: nt(result.taxAnalysis.houseLandIncomeTax ?? 0), operator: '×' },
        { label: '房地交易所得稅', value: nt(result.taxAnalysis.houseLandIncomeTax ?? 0), operator: '=' },
        { label: '土地增值稅', value: inputs.taxProfile.landValueIncrementTax === null ? '尚未填寫' : nt(result.taxAnalysis.landValueIncrementTax), operator: '+' },
        { label: '賣房稅費合計', value: nt(result.tax), operator: '=' },
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
        { label: '出售實拿', value: nt(result.netCash) },
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
  }), [enteredAcquisitionCosts, inputs, result])

  const chart = useMemo(() => [
    {
      year: '購入時',
      equity: Math.max(0, inputs.purchasePrice - inputs.originalLoan) / 10_000,
    },
    {
      year: '目前',
      equity: Math.max(0, inputs.salePrice - inputs.currentLoanBalance) / 10_000,
    },
  ], [inputs])

  const showScenarioDetail = (scenarioResult: typeof scenarioComparisons[number]) => {
    const comparison = scenarioResult.result
    setDetail({
      title: `${scenarioResult.label}成交價情境`,
      result: nt(scenarioResult.salePrice),
      summary: '這五個情境只改變預估成交價，其餘房屋、貸款、稅率、成本與出售日期完全相同。',
      formula: '情境成交價 = 基準預估成交價 ± 情境差額',
      rows: [
        { label: '基準預估成交價', value: nt(inputs.salePrice) },
        { label: '情境調整', value: `${scenarioResult.offset >= 0 ? '+' : '−'}${nt(Math.abs(scenarioResult.offset))}` },
        { label: '情境成交價', value: nt(scenarioResult.salePrice), operator: '=' },
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
      { id: crypto.randomUUID(), name: '', amount: 0 },
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
  const saveProfile = (profile: PropertyProfile) => {
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
    setEditingProperty(null)
  }

  return <div className="app">
    <aside>
      <div className="brand"><div className="logo">H</div><div><strong>HouseVest</strong><span>Property Intelligence</span></div></div>
      <nav>
        <button className="active"><Building2 size={18}/>Dashboard</button>
        <button><LineChart size={18}/>投資分析</button>
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
      <header><div><p className="eyebrow">MY PROPERTY</p><h1>{activeProperty.name}資產儀表板</h1><p>{activeProperty.address || '尚未設定地址'}・用同一組已儲存資料理解房價、貸款、稅金與自有資金績效。</p></div><button className="score" onClick={() => setDetail(details.score)}><span>HouseVest Score</span><strong>{result.score}</strong><small>/ 100</small><em>查看依據</em></button></header>

      <section className="metrics">
        <Card label="賣房稅費" value={result.taxAnalysis.complete ? nt(result.tax) : `${nt(result.tax)}（資料未齊）`} note={`${result.taxAnalysis.regimeLabel}・查看法規判定`} onClick={() => setDetail(details.transactionTax)} />
      </section>

      <section className="grid">
        <article className="panel performance">
          <div className="panelTitle"><div><p className="eyebrow">PRICE SCENARIO COMPARISON</p><h2>五種成交價情境比較</h2></div><Sparkles size={20}/></div>
          <p className="comparisonSummary">以目前設定的 {nt(inputs.salePrice)} 為基準，自動比較上下 50 萬與 100 萬的投資結果。</p>
          <div className="scenarioTableWrap">
            <table className="scenarioTable">
              <thead><tr><th>投資績效</th>{scenarioComparisons.map(item => <th className={item.offset === 0 ? 'baseline' : ''} key={item.offset}><span>{item.label}</span><strong>{nt(item.salePrice)}</strong></th>)}</tr></thead>
              <tbody>
                <tr><th>所得稅初估</th>{scenarioComparisons.map(item => <td className={item.offset === 0 ? 'baseline' : ''} key={item.offset}>{nt(item.result.tax)}</td>)}</tr>
                <tr><th>出售實拿</th>{scenarioComparisons.map(item => <td className={item.offset === 0 ? 'baseline' : ''} key={item.offset}>{nt(item.result.netCash)}</td>)}</tr>
                <tr><th>稅後獲利</th>{scenarioComparisons.map(item => <td className={item.offset === 0 ? 'baseline' : ''} key={item.offset}>{nt(item.result.profit)}</td>)}</tr>
                <tr><th>房屋 CAGR</th>{scenarioComparisons.map(item => <td className={item.offset === 0 ? 'baseline' : ''} key={item.offset}>{pct(item.result.cagr)}</td>)}</tr>
                <tr><th>自有資金 IRR</th>{scenarioComparisons.map(item => <td className={item.offset === 0 ? 'baseline' : ''} key={item.offset}>{Number.isFinite(item.result.leveragedIrr) ? pct(item.result.leveragedIrr) : '無法計算'}</td>)}</tr>
                <tr className="scenarioActions"><th>計算依據</th>{scenarioComparisons.map(item => <td className={item.offset === 0 ? 'baseline' : ''} key={item.offset}><button onClick={() => showScenarioDetail(item)}><Calculator size={13}/>查看</button></td>)}</tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel controls">
          <div className="panelTitle"><div><p className="eyebrow">LIVE SCENARIO</p><h2>成交價情境</h2></div><SlidersHorizontal size={20}/></div>
          <label className="priceInput"><span>預估成交價</span><div><input aria-label="預估成交價" type="number" min="0" step="10000" placeholder="直接輸入金額" value={inputs.salePrice || ''} onChange={event => updateScenarioNumber('salePrice', event.target.value === '' ? 0 : Number(event.target.value))}/></div></label>
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
              <button type="button" aria-label={`刪除${cost.name || '出售成本'}`} onClick={() => removeSellingCost(cost.id)}><Trash2 size={13}/></button>
            </div>)}
            <div className="sellingCostTotal"><span>出售成本合計</span><strong>{nt(result.saleCosts)}</strong></div>
          </div>
        </article>
      </section>

      <section className="panel chartPanel">
        <div className="panelTitle"><div><p className="eyebrow">EQUITY CHANGE</p><h2>購入時與目前房屋淨值</h2></div></div>
        <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="year"/><YAxis tickFormatter={v => `${v}萬`}/><Tooltip formatter={(v) => [`${money(Number(v))} 萬`, '淨資產']}/><Area type="monotone" dataKey="equity" stroke="currentColor" fill="currentColor" fillOpacity={0.12}/></AreaChart></ResponsiveContainer></div>
      </section>
      {detail && <CalculationDrawer detail={detail} onClose={() => setDetail(null)} />}
      {editingProperty && <PropertyEditor profile={editingProperty} onChange={setEditingProperty} onSave={saveProfile} onClose={() => setEditingProperty(null)} />}
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
        {detail.rows.map((row, index) => <div className={row.operator === '=' ? 'total' : ''} key={`${row.label}-${index}`}>
          <i>{row.operator ?? ''}</i><span>{row.label}</span><strong>{row.value}</strong>
        </div>)}
      </div>
      {detail.note && <div className="caveat"><b>範圍與限制</b><p>{detail.note}</p></div>}
    </aside>
  </div>
}

function PropertyEditor({ profile, onChange, onSave, onClose }: { profile: PropertyProfile; onChange: (profile: PropertyProfile) => void; onSave: (profile: PropertyProfile) => void; onClose: () => void }) {
  const [recognizing, setRecognizing] = useState(false)
  const updateText = (key: 'name' | 'address' | 'purchaseDate' | 'mortgageDataDate', value: string) =>
    onChange({ ...profile, [key]: value })
  const updateNumber = (key: 'purchasePrice' | 'originalLoan' | 'currentLoanBalance' | 'totalMortgagePaymentsPaid' | 'paymentEstimateAnnualRate' | 'originalLoanTermYears' | 'annualRate' | 'remainingLoanYears' | 'currentMarketValue', value: number) =>
    onChange({ ...profile, [key]: value })
  const updateCost = (key: keyof PropertyProfile['acquisitionCosts'], value: number) =>
    onChange({ ...profile, acquisitionCosts: { ...profile.acquisitionCosts, [key]: value } })
  const updateTaxProfile = (changes: Partial<PropertyProfile['taxProfile']>) =>
    onChange({ ...profile, taxProfile: { ...profile.taxProfile, ...changes } })
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
  const removeCustomCost = (id: string) => onChange({
    ...profile,
    customAcquisitionCosts: profile.customAcquisitionCosts.filter(cost => cost.id !== id),
  })
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

  return <div className="drawerBackdrop" role="presentation" onMouseDown={onClose}>
    <aside className="drawer propertyEditor" role="dialog" aria-modal="true" aria-label="房屋基本資料" onMouseDown={event => event.stopPropagation()}>
      <div className="drawerHeader"><div><p className="eyebrow">PROPERTY DATABASE</p><h2>房屋基本資料</h2></div><button aria-label="關閉房屋基本資料" onClick={onClose}><X size={20}/></button></div>
      <p className="drawerSummary">儲存後，Dashboard、出售分析、CAGR 與 IRR 都會共用這份資料。</p>
      <button className="openRecognition" type="button" onClick={() => setRecognizing(true)}><Camera size={17}/>免費從多張文件照片帶入</button>
      <form onSubmit={event => { event.preventDefault(); onSave(profile) }}>
        <EditorSection title="識別資料">
          <TextInput label="房屋名稱" value={profile.name} onChange={value => updateText('name', value)} required />
          <TextInput label="地址或備註" value={profile.address} onChange={value => updateText('address', value)} />
          <TextInput label="購入成交日" type="date" value={profile.purchaseDate} onChange={value => updateText('purchaseDate', value)} required />
          <NumberInput label="目前預估市值" value={profile.currentMarketValue} onChange={value => updateNumber('currentMarketValue', value)} />
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
          <SelectInput label="納稅人身分" value={profile.taxProfile.residency} onChange={value => updateTaxProfile({ residency: value as PropertyProfile['taxProfile']['residency'] })}>
            <option value="resident">中華民國境內居住者</option>
            <option value="nonresident">非境內居住者</option>
          </SelectInput>
          <SelectInput label="出售費用認列方式" value={profile.taxProfile.sellingExpenseMethod} onChange={value => updateTaxProfile({ sellingExpenseMethod: value as PropertyProfile['taxProfile']['sellingExpenseMethod'] })}>
            <option value="documented">依實際憑證</option>
            <option value="statutory">無完整憑證，依法定推計</option>
          </SelectInput>
          <NumberInput label="前3年可扣抵房地交易損失" value={profile.taxProfile.priorThreeYearTransactionLoss} onChange={value => updateTaxProfile({ priorThreeYearTransactionLoss: value })} />
          <NullableNumberInput label="土地漲價總數額" value={profile.taxProfile.landPriceIncrementTotal} onChange={value => updateTaxProfile({ landPriceIncrementTotal: value })} />
          <NullableNumberInput label="土地增值稅核定／官方試算額" value={profile.taxProfile.landValueIncrementTax} onChange={value => updateTaxProfile({ landValueIncrementTax: value })} />
          <NumberInput label="可列費用的土地增值稅部分" value={profile.taxProfile.deductibleLandValueIncrementTax} onChange={value => updateTaxProfile({ deductibleLandValueIncrementTax: value })} />
          <CheckInput label="準備申請自住房地優惠" checked={profile.taxProfile.claimsSelfUseBenefit} onChange={checked => updateTaxProfile({ claimsSelfUseBenefit: checked })} />
          {profile.taxProfile.claimsSelfUseBenefit && <div className="taxQualifications">
            <CheckInput label="本人、配偶或未成年子女設籍、持有並居住連續滿6年" checked={profile.taxProfile.householdRegisteredAndLivedSixYears} onChange={checked => updateTaxProfile({ householdRegisteredAndLivedSixYears: checked })} />
            <CheckInput label="交易前6年內未出租、營業或執行業務" checked={profile.taxProfile.noRentalOrBusinessUseSixYears} onChange={checked => updateTaxProfile({ noRentalOrBusinessUseSixYears: checked })} />
            <CheckInput label="本人、配偶及未成年子女前6年未用過此優惠" checked={profile.taxProfile.noSelfUseBenefitInPriorSixYears} onChange={checked => updateTaxProfile({ noSelfUseBenefitInPriorSixYears: checked })} />
          </div>}
          <CheckInput label="確認符合財政部公告的非自願性交易資格" checked={profile.taxProfile.involuntaryTransferEligible} onChange={checked => updateTaxProfile({ involuntaryTransferEligible: checked })} />
          <div className="taxNotice warning">土地增值稅請優先填入地方稅機關核定或官方試算結果；房地成交價無法可靠推回公告土地現值。</div>
        </EditorSection>
        <div className="storageNote">資料只儲存在這台裝置的此瀏覽器中，不會上傳到伺服器。</div>
        <button className="saveProperty" type="submit">儲存並套用</button>
      </form>
      {recognizing && <DocumentRecognition profile={profile} onApply={next => { onChange(next); setRecognizing(false) }} onClose={() => setRecognizing(false)} />}
    </aside>
  </div>
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="editorSection"><h3>{title}</h3>{children}</section>
}

function TextInput({ label, value, type = 'text', required = false, onChange }: { label: string; value: string; type?: string; required?: boolean; onChange: (value: string) => void }) {
  return <label className="editorField"><span>{label}</span><input type={type} value={value} required={required} onChange={event => onChange(event.target.value)} /></label>
}

function NumberInput({ label, value, suffix = '', step = 1, onChange }: { label: string; value: number; suffix?: string; step?: number; onChange: (value: number) => void }) {
  return <label className="editorField"><span>{label}</span><div><input type="number" min="0" step={step} placeholder="0" value={value || ''} onChange={event => onChange(event.target.value === '' ? 0 : Number(event.target.value))} />{suffix && <em>{suffix}</em>}</div></label>
}

function NullableNumberInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return <label className="editorField"><span>{label}</span><div><input type="number" min="0" placeholder="尚未填寫" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))} /></div></label>
}

function SelectInput({ label, value, children, onChange }: { label: string; value: string; children: ReactNode; onChange: (value: string) => void }) {
  return <label className="editorField"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>
}

function CheckInput({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="checkField"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>
}

function Field({ label, value, suffix, step = 1, onChange }: { label: string; value: number; suffix: string; step?: number; onChange: (v: number) => void }) {
  return <label className="field"><span>{label}</span><div><input type="number" value={value} step={step} onChange={e => onChange(Number(e.target.value))}/><em>{suffix}</em></div></label>
}

function DateField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (v: string) => void }) {
  return <label className="field dateField"><span>{label}</span><input type="date" value={value} min={min} max={max} onChange={e => onChange(e.target.value)}/></label>
}

export default App
