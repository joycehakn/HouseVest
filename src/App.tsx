import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Building2, Calculator, Landmark, LineChart, PiggyBank, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import {
  calculatePropertyAnalysis,
  mortgageBalance,
  type PropertyInputs as Inputs,
} from './calculations/propertyAnalysis'

const initial: Inputs = {
  purchasePrice: 14_100_000,
  acquisitionCosts: 230_867,
  originalLoan: 11_980_000,
  annualRate: 2.18,
  loanYears: 30,
  salePrice: 17_500_000,
  saleCostsRate: 4,
  taxRate: 20,
  holdingYears: 5,
}

const money = (n: number) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(Math.round(n))
const pct = (n: number) => `${n.toFixed(1)}%`
const nt = (n: number) => `NT$ ${money(n)}`

type CalculationDetail = {
  title: string
  result: string
  summary: string
  formula: string
  rows: { label: string; value: string; operator?: string }[]
  note?: string
}

function App() {
  const [inputs, setInputs] = useState(initial)
  const [detail, setDetail] = useState<CalculationDetail | null>(null)
  const result = useMemo(() => calculatePropertyAnalysis(inputs), [inputs])

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
      summary: `以本息平均攤還、固定年利率 ${inputs.annualRate}% 計算持有 ${inputs.holdingYears} 年後的剩餘本金。`,
      formula: '餘額 = 原始本金 × (1+r)^k − 月付金 × ((1+r)^k−1) ÷ r',
      rows: [
        { label: '原始貸款', value: nt(inputs.originalLoan) },
        { label: '月利率 r', value: `${(inputs.annualRate / 12).toFixed(4)}%` },
        { label: '已付款期數 k', value: `${result.paidMonths} 期` },
        { label: '每月本息付款', value: nt(result.monthlyPayment) },
        { label: '期末貸款餘額', value: nt(result.balance), operator: '=' },
      ],
      note: '假設利率固定、每月正常繳款，未納入寬限期、提前還款與違約金。',
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
        { label: `出售成本（${inputs.saleCostsRate}%）`, value: nt(result.saleCosts), operator: '−' },
        { label: `簡化稅額（${inputs.taxRate}%）`, value: nt(result.tax), operator: '−' },
        { label: '貸款餘額', value: nt(result.balance), operator: '−' },
        { label: '出售實拿', value: nt(result.netCash), operator: '=' },
      ],
      note: `目前稅額 = max(售價 − 購入價 − 取得成本 − 出售成本, 0) × 假設稅率。尚未納入土地漲價總數額、自住優惠、可扣除費用認定等正式稅務規則。課稅所得目前為 ${nt(result.taxableGain)}。`,
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
        { label: '持有期間', value: `${inputs.holdingYears} 年` },
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
        { label: '期初自有資金', value: `−${nt(result.initialEquity)}` },
        { label: '每月房貸付款', value: `−${nt(result.monthlyPayment)}` },
        { label: '付款期數', value: `${result.paidMonths} 期` },
        { label: '累積房貸付款', value: `−${nt(result.totalMortgagePayments)}` },
        { label: '出售月份回收', value: nt(result.netCash) },
        { label: '年化 IRR', value: Number.isFinite(result.leveragedIrr) ? pct(result.leveragedIrr) : '無法計算', operator: '=' },
      ],
      note: '這一版已改為正式的逐月現金流 IRR，但仍未納入持有稅費、管理費、修繕、租金收入與機會成本。',
    },
    profit: {
      title: '稅後獲利',
      result: nt(result.profit),
      summary: '把出售實拿減去期初自有資金，以及持有期間實際繳出的全部房貸款。',
      formula: '稅後獲利 = 出售實拿 − 期初自有資金 − 累積房貸付款',
      rows: [
        { label: '出售實拿', value: nt(result.netCash) },
        { label: '期初自有資金', value: nt(result.initialEquity), operator: '−' },
        { label: '累積房貸付款', value: nt(result.totalMortgagePayments), operator: '−' },
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
  }), [inputs, result])

  const chart = useMemo(() => Array.from({ length: inputs.holdingYears + 1 }, (_, year) => {
    const price = inputs.purchasePrice * Math.pow(inputs.salePrice / inputs.purchasePrice, year / inputs.holdingYears)
    const balance = mortgageBalance(inputs.originalLoan, inputs.annualRate, inputs.loanYears, year)
    return { year: `第${year}年`, equity: Math.max(0, price - balance) / 10_000 }
  }), [inputs])

  const update = (key: keyof Inputs, value: number) => setInputs(v => ({ ...v, [key]: value }))

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
      <header><div><p className="eyebrow">MY PROPERTY</p><h1>板橋新府路資產儀表板</h1><p>用同一組數據理解房價、貸款、稅金與自有資金績效。</p></div><button className="score" onClick={() => setDetail(details.score)}><span>HouseVest Score</span><strong>{result.score}</strong><small>/ 100</small><em>查看依據</em></button></header>

      <section className="metrics">
        <Card label="預估市值" value={nt(inputs.salePrice)} note="可用滑桿調整" onClick={() => setDetail(details.marketValue)} />
        <Card label="貸款餘額" value={nt(result.balance)} note={`${inputs.annualRate}%・${inputs.loanYears} 年`} onClick={() => setDetail(details.balance)} />
        <Card label="房屋淨值" value={nt(result.equity)} note="市值減貸款" onClick={() => setDetail(details.equity)} />
        <Card label="出售實拿" value={nt(result.netCash)} note="扣交易成本、稅與貸款" onClick={() => setDetail(details.netCash)} />
      </section>

      <section className="grid">
        <article className="panel performance">
          <div className="panelTitle"><div><p className="eyebrow">INVESTMENT PERFORMANCE</p><h2>投資績效</h2></div><Sparkles size={20}/></div>
          <div className="performanceGrid">
            <Metric label="房屋 CAGR" value={pct(result.cagr)} note="房屋本身扣除出售成本與簡化稅額後的年化成長。" onClick={() => setDetail(details.cagr)} />
            <Metric label="自有資金 IRR" value={Number.isFinite(result.leveragedIrr) ? pct(result.leveragedIrr) : '無法計算'} note="納入期初資金、逐月房貸與出售回收的年化報酬。" onClick={() => setDetail(details.irr)} />
            <Metric label="稅後獲利" value={nt(result.profit)} note="出售實拿扣除期初資金與累積房貸付款。" onClick={() => setDetail(details.profit)} />
          </div>
          <div className="insight"><b>HouseVest 洞察</b><p>{result.leveragedIrr > result.cagr * 2 ? '房屋本身增值溫和，但貸款槓桿明顯放大了自有資金報酬。請同時留意利率與每月現金流風險。' : '房屋本身增值與自有資金報酬接近，槓桿放大效果較有限。'}</p></div>
        </article>

        <article className="panel controls">
          <div className="panelTitle"><div><p className="eyebrow">LIVE SCENARIO</p><h2>成交價情境</h2></div><SlidersHorizontal size={20}/></div>
          <label>預估成交價 <b>NT$ {money(inputs.salePrice)}</b></label>
          <input type="range" min="16_000_000" max="20_000_000" step="100_000" value={inputs.salePrice} onChange={e => update('salePrice', Number(e.target.value))}/>
          <div className="range"><span>1,600 萬</span><span>2,000 萬</span></div>
          <Field label="持有年數" value={inputs.holdingYears} suffix="年" onChange={v => update('holdingYears', v)} />
          <Field label="出售成本率" value={inputs.saleCostsRate} suffix="%" step={0.1} onChange={v => update('saleCostsRate', v)} />
          <Field label="房地合一稅率" value={inputs.taxRate} suffix="%" step={1} onChange={v => update('taxRate', v)} />
        </article>
      </section>

      <section className="panel chartPanel">
        <div className="panelTitle"><div><p className="eyebrow">EQUITY GROWTH</p><h2>房屋淨資產變化</h2></div></div>
        <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="year"/><YAxis tickFormatter={v => `${v}萬`}/><Tooltip formatter={(v) => [`${money(Number(v))} 萬`, '淨資產']}/><Area type="monotone" dataKey="equity" stroke="currentColor" fill="currentColor" fillOpacity={0.12}/></AreaChart></ResponsiveContainer></div>
      </section>
      {detail && <CalculationDrawer detail={detail} onClose={() => setDetail(null)} />}
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

function Field({ label, value, suffix, step = 1, onChange }: { label: string; value: number; suffix: string; step?: number; onChange: (v: number) => void }) {
  return <label className="field"><span>{label}</span><div><input type="number" value={value} step={step} onChange={e => onChange(Number(e.target.value))}/><em>{suffix}</em></div></label>
}

export default App
