import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Building2, Landmark, LineChart, PiggyBank, SlidersHorizontal, Sparkles } from 'lucide-react'

type Inputs = {
  purchasePrice: number
  acquisitionCosts: number
  originalLoan: number
  annualRate: number
  loanYears: number
  salePrice: number
  saleCostsRate: number
  taxRate: number
  holdingYears: number
}

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

function mortgageBalance(principal: number, annualRate: number, years: number, paidYears: number) {
  const r = annualRate / 100 / 12
  const n = years * 12
  const k = Math.min(paidYears * 12, n)
  if (r === 0) return principal * (1 - k / n)
  const payment = principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
  return principal * Math.pow(1 + r, k) - payment * (Math.pow(1 + r, k) - 1) / r
}

function App() {
  const [inputs, setInputs] = useState(initial)
  const result = useMemo(() => {
    const totalCost = inputs.purchasePrice + inputs.acquisitionCosts
    const balance = mortgageBalance(inputs.originalLoan, inputs.annualRate, inputs.loanYears, inputs.holdingYears)
    const saleCosts = inputs.salePrice * inputs.saleCostsRate / 100
    const taxableGain = Math.max(0, inputs.salePrice - totalCost - saleCosts)
    const tax = taxableGain * inputs.taxRate / 100
    const netCash = inputs.salePrice - saleCosts - tax - balance
    const initialEquity = totalCost - inputs.originalLoan
    const profit = netCash - initialEquity
    const cagr = (Math.pow((inputs.salePrice - saleCosts - tax) / totalCost, 1 / inputs.holdingYears) - 1) * 100
    const leveragedIrr = (Math.pow(netCash / initialEquity, 1 / inputs.holdingYears) - 1) * 100
    const equity = inputs.salePrice - balance
    const score = Math.max(0, Math.min(100, Math.round(55 + cagr * 4 + leveragedIrr * 1.8 - inputs.annualRate * 2)))
    return { totalCost, balance, saleCosts, tax, netCash, profit, cagr, leveragedIrr, initialEquity, equity, score }
  }, [inputs])

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
      <header><div><p className="eyebrow">MY PROPERTY</p><h1>板橋新府路資產儀表板</h1><p>用同一組數據理解房價、貸款、稅金與自有資金績效。</p></div><div className="score"><span>HouseVest Score</span><strong>{result.score}</strong><small>/ 100</small></div></header>

      <section className="metrics">
        <Card label="預估市值" value={`NT$ ${money(inputs.salePrice)}`} note="可用滑桿調整" />
        <Card label="貸款餘額" value={`NT$ ${money(result.balance)}`} note={`${inputs.annualRate}%・${inputs.loanYears} 年`} />
        <Card label="房屋淨值" value={`NT$ ${money(result.equity)}`} note="市值減貸款" />
        <Card label="出售實拿" value={`NT$ ${money(result.netCash)}`} note="扣交易成本、稅與貸款" />
      </section>

      <section className="grid">
        <article className="panel performance">
          <div className="panelTitle"><div><p className="eyebrow">INVESTMENT PERFORMANCE</p><h2>投資績效</h2></div><Sparkles size={20}/></div>
          <div className="performanceGrid">
            <div><span>房屋 CAGR</span><strong>{pct(result.cagr)}</strong><p>衡量房屋本身扣除出售成本與稅後的年化成長。</p></div>
            <div><span>槓桿 IRR</span><strong>{pct(result.leveragedIrr)}</strong><p>衡量頭期款等自有資金，透過房貸槓桿後的年化成果。</p></div>
            <div><span>稅後獲利</span><strong>NT$ {money(result.profit)}</strong><p>出售實拿減去最初投入的自有資金。</p></div>
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
    </main>
  </div>
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function Field({ label, value, suffix, step = 1, onChange }: { label: string; value: number; suffix: string; step?: number; onChange: (v: number) => void }) {
  return <label className="field"><span>{label}</span><div><input type="number" value={value} step={step} onChange={e => onChange(Number(e.target.value))}/><em>{suffix}</em></div></label>
}

export default App
