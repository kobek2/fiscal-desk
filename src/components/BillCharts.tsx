import { formatMoney, formatPct } from '../economy'

interface Slice {
  name: string
  value: number
  color: string
}

export function RevenueDonut({ data }: { data: Slice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const size = 180
  const r = 70
  const cx = size / 2
  const cy = size / 2
  let angle = -Math.PI / 2

  const paths = data.map((d) => {
    const sweep = (d.value / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    return { ...d, path, pct: d.value / total }
  })

  return (
    <div className="chart-block">
      <h4>Revenue mix</h4>
      <div className="chart-row">
        <svg viewBox={`0 0 ${size} ${size}`} className="donut" aria-hidden>
          {paths.map((p) => (
            <path key={p.name} d={p.path} fill={p.color} />
          ))}
          <circle cx={cx} cy={cy} r={38} fill="#fffef8" />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="donut-label"
          >
            Total
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="donut-value"
          >
            {formatMoney(total)}
          </text>
        </svg>
        <ul className="chart-legend">
          {paths.map((p) => (
            <li key={p.name}>
              <span className="swatch" style={{ background: p.color }} />
              <span>
                {p.name}
                <em>
                  {formatMoney(p.value)} · {formatPct(p.pct, 0)}
                </em>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

interface BarRow {
  short: string
  name: string
  baseline: number
  allocated: number
}

export function SpendingBars({ data }: { data: BarRow[] }) {
  const max = Math.max(...data.map((d) => Math.max(d.baseline, d.allocated)), 1)
  return (
    <div className="chart-block">
      <h4>Department funding vs baseline</h4>
      <p className="chart-caption">
        Green = this year’s allocation · Gray = prior baseline (maintain services)
      </p>
      <div className="bar-chart">
        {data.map((d) => (
          <div key={d.name} className="bar-row" title={d.name}>
            <span className="bar-label">{d.short}</span>
            <div className="bar-tracks">
              <div
                className="bar baseline"
                style={{ width: `${(d.baseline / max) * 100}%` }}
              />
              <div
                className="bar allocated"
                style={{ width: `${(d.allocated / max) * 100}%` }}
              />
            </div>
            <span className="bar-amt">{formatMoney(d.allocated)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BalanceMeter({
  revenue,
  spending,
  balance,
}: {
  revenue: number
  spending: number
  balance: number
}) {
  const max = Math.max(revenue, spending, 1)
  return (
    <div className="chart-block">
      <h4>Budget balance</h4>
      <div className="balance-meter">
        <div className="meter-row">
          <span>Revenue</span>
          <div className="meter-track">
            <div
              className="meter-fill rev"
              style={{ width: `${(revenue / max) * 100}%` }}
            />
          </div>
          <strong>{formatMoney(revenue)}</strong>
        </div>
        <div className="meter-row">
          <span>Spending</span>
          <div className="meter-track">
            <div
              className="meter-fill spend"
              style={{ width: `${(spending / max) * 100}%` }}
            />
          </div>
          <strong>{formatMoney(spending)}</strong>
        </div>
        <p className={`meter-result ${balance >= 0 ? 'pos' : 'neg'}`}>
          {balance >= 0 ? 'Projected surplus' : 'Projected deficit'}:{' '}
          {formatMoney(Math.abs(balance))}
        </p>
      </div>
    </div>
  )
}
