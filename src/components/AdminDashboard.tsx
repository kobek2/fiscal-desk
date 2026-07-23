import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { EconomyState } from '../economy'
import {
  formatMoney,
  formatPct,
  growthFromJoins,
  joinsFromTotals,
  projectBudget,
  recordMembership,
} from '../economy'

interface Props {
  state: EconomyState
  onChange: Dispatch<SetStateAction<EconomyState>>
}

export function AdminDashboard({ state, onChange }: Props) {
  const m = state.membership
  const federal = state.governments.federal
  const proj = useMemo(() => projectBudget(federal), [federal])

  const [mode, setMode] = useState<'joins' | 'total'>('joins')
  const [joinsInput, setJoinsInput] = useState(
    m.joinsThisYear != null ? String(m.joinsThisYear) : '',
  )
  const [totalInput, setTotalInput] = useState(
    m.currentTotalMembers != null ? String(m.currentTotalMembers) : '',
  )

  const previewJoins = useMemo(() => {
    if (mode === 'joins') {
      const n = Number(joinsInput)
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
    }
    const total = Number(totalInput)
    if (!Number.isFinite(total) || total < 0) return null
    if (m.lastTotalMembers == null) return null
    return joinsFromTotals(m.lastTotalMembers, total)
  }, [mode, joinsInput, totalInput, m.lastTotalMembers])

  const outlook =
    previewJoins != null ? growthFromJoins(previewJoins, m) : null

  const save = () => {
    if (mode === 'joins') {
      const n = Number(joinsInput)
      if (!Number.isFinite(n) || n < 0) {
        alert('Enter a whole number of people who joined (0 or more).')
        return
      }
      onChange((prev) =>
        recordMembership(prev, { mode: 'joins', joins: Math.floor(n) }),
      )
      return
    }
    const total = Number(totalInput)
    if (!Number.isFinite(total) || total < 0) {
      alert('Enter the current total members on the server.')
      return
    }
    onChange((prev) =>
      recordMembership(prev, {
        mode: 'total',
        totalMembers: Math.floor(total),
      }),
    )
  }

  return (
    <section className="panel admin-dashboard">
      <header>
        <p className="eyebrow">Staff only</p>
        <h2>Admin Dashboard</h2>
        <p className="panel-note">
          Record Discord membership for this fiscal year. Growth is calculated
          automatically when the budget is submitted.
        </p>
      </header>

      <div className="admin-kpi-grid">
        <AdminStat label="Fiscal year" value={`FY ${state.period.fiscalYear}`} />
        <AdminStat
          label="Federal GDP"
          value={formatMoney(federal.economy.gdp)}
        />
        <AdminStat
          label="Last GDP growth"
          value={formatPct(federal.economy.gdpGrowthRateAnnualized)}
          tone={
            federal.economy.gdpGrowthRateAnnualized > 0
              ? 'pos'
              : federal.economy.gdpGrowthRateAnnualized < 0
                ? 'neg'
                : undefined
          }
        />
        <AdminStat
          label="National debt"
          value={formatMoney(federal.treasury.nationalDebt)}
        />
        <AdminStat label="Debt / GDP" value={formatPct(proj.debtToGdp, 0)} />
        <AdminStat
          label="Unemployment"
          value={formatPct(federal.economy.unemploymentRate)}
        />
        <AdminStat
          label="Joins this FY"
          value={
            m.joinsThisYear == null
              ? 'Not recorded'
              : String(m.joinsThisYear)
          }
          tone={m.joinsThisYear == null ? 'neg' : 'pos'}
        />
        <AdminStat
          label="Last total members"
          value={
            m.lastTotalMembers == null
              ? '—'
              : m.lastTotalMembers.toLocaleString('en-US')
          }
        />
      </div>

      <div className="admin-card admin-card-wide">
        <h3>Record Discord membership</h3>
        <div className="admin-mode-toggle" role="group" aria-label="Input mode">
          <button
            type="button"
            className={mode === 'joins' ? 'active' : ''}
            onClick={() => setMode('joins')}
          >
            Joins this year
          </button>
          <button
            type="button"
            className={mode === 'total' ? 'active' : ''}
            onClick={() => setMode('total')}
          >
            Total members
          </button>
        </div>

        {mode === 'joins' ? (
          <label className="field">
            <span>People who joined since last FY close</span>
            <input
              type="text"
              inputMode="numeric"
              value={joinsInput}
              placeholder="e.g. 5"
              onChange={(e) =>
                setJoinsInput(e.target.value.replace(/[^0-9]/g, ''))
              }
            />
          </label>
        ) : (
          <label className="field">
            <span>
              Current total server members
              {m.lastTotalMembers != null && (
                <> (was {m.lastTotalMembers.toLocaleString('en-US')})</>
              )}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={totalInput}
              placeholder="e.g. 248"
              onChange={(e) =>
                setTotalInput(e.target.value.replace(/[^0-9]/g, ''))
              }
            />
            {m.lastTotalMembers == null && (
              <em className="field-hint">
                First entry sets the baseline only. Enter a later total (or use
                Joins) for growth.
              </em>
            )}
          </label>
        )}

        {outlook && (
          <div className={`admin-outlook phase-${outlook.phase}`}>
            <strong>
              Projected GDP growth: {formatPct(outlook.rate)} ({outlook.phase})
            </strong>
            <p className="admin-outlook-detail">
              Applied nationally at FY submit — employment and baselines move
              with it.
            </p>
          </div>
        )}

        <button type="button" className="btn primary" onClick={save}>
          Save membership for FY{state.period.fiscalYear}
        </button>
      </div>
    </section>
  )
}

function AdminStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg'
}) {
  return (
    <div className={`admin-stat ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
