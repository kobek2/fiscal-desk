import { useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react'
import type {
  EconomyState,
  GovId,
  OptionalTax,
  TaxBracket,
} from '../economy'
import {
  REGION_META,
  balanceBudget,
  formatMoney,
  formatPct,
  formatPeople,
  jobOpenings,
  laborForce,
  projectBudget,
  submitBudget,
  updateJurisdiction,
} from '../economy'

type CenterTab = 'income' | 'optional' | 'spending'

interface Props {
  state: EconomyState
  govId: GovId
  onChange: Dispatch<SetStateAction<EconomyState>>
}

export function BudgetWorkspace({ state, govId, onChange }: Props) {
  const gov = state.governments[govId]
  const proj = useMemo(() => projectBudget(gov), [gov])
  const [centerTab, setCenterTab] = useState<CenterTab>('income')
  const [activeDept, setActiveDept] = useState<string | null>(
    gov.departments.find((d) => d.type === 'discretionary')?.id ?? gov.departments[0]?.id ?? null,
  )

  const meta =
    govId !== 'federal' ? REGION_META[govId as keyof typeof REGION_META] : null

  const patchGov = (fn: (g: typeof gov) => void) => {
    onChange((prev) =>
      updateJurisdiction(prev, govId, (g) => {
        const copy = structuredClone(g)
        fn(copy)
        return copy
      }),
    )
  }

  const lf = laborForce(gov)
  const jobs = jobOpenings(gov)
  const growth = gov.economy.gdpGrowthRateAnnualized
  const membershipReady = state.membership.joinsThisYear != null

  return (
    <section className="workspace">
      <header className="sheet-header">
        <div>
          <p className="eyebrow">
            FY {gov.period.fiscalYear} · annual budget
          </p>
          <h2>{gov.name}</h2>
          {meta && <p className="states-line">{meta.states}</p>}
        </div>
        <div className={`balance-status ${proj.balance >= 0 ? 'surplus' : 'deficit'} debt-${proj.debtFlag}`}>
          <span className="balance-label">
            {proj.balance >= 0 ? 'Surplus' : 'Raising debt'} · Debt/GDP{' '}
            {formatPct(proj.debtToGdp, 0)}
          </span>
          <strong className="balance-figure">{formatMoney(proj.balance)}/yr</strong>
          <span className="balance-sub">
            Year-end debt path → {formatMoney(proj.yearEndDebtPath)}{' '}
            (current debt + this year’s deficit)
          </span>
        </div>
      </header>

      <div className="kpi-strip">
        <Kpi label="GDP" value={formatMoney(gov.economy.gdp)} />
        <Kpi
          label="GDP growth"
          value={formatPct(growth)}
          tone={growth > 0 ? 'pos' : growth < 0 ? 'neg' : undefined}
        />
        <Kpi label="National debt" value={formatMoney(gov.treasury.nationalDebt)} />
        <Kpi label="Debt / GDP" value={formatPct(proj.debtToGdp, 0)} />
        <Kpi label="Unemployment" value={formatPct(gov.economy.unemploymentRate)} />
        <Kpi label="Job openings" value={formatPeople(jobs)} />
        <Kpi label="Labor force" value={formatPeople(lf)} />
        <Kpi
          label="Fiscal stance"
          value={proj.fiscalStance}
          tone={
            proj.fiscalStance === 'Stimulating'
              ? 'pos'
              : proj.fiscalStance === 'Contracting'
                ? 'neg'
                : undefined
          }
        />
      </div>

      <div className="workspace-grid">
        <aside className="sidebar">
          <p className="sidebar-title">Categories</p>
          <nav>
            <button
              type="button"
              className={centerTab === 'income' ? 'active' : ''}
              onClick={() => setCenterTab('income')}
            >
              Income Tax
            </button>
            <button
              type="button"
              className={centerTab === 'optional' ? 'active' : ''}
              onClick={() => setCenterTab('optional')}
            >
              Optional Taxes
            </button>
            <button
              type="button"
              className={centerTab === 'spending' ? 'active' : ''}
              onClick={() => setCenterTab('spending')}
            >
              Departments
            </button>
          </nav>
          {centerTab === 'spending' && (
            <div className="dept-nav">
              <p className="sidebar-title">Departments</p>
              {gov.departments.map((d) => {
                const st = proj.deptStatus.find((s) => s.id === d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`dept-link ${activeDept === d.id ? 'active' : ''} ${st?.status === 'Below baseline' ? 'warn' : ''}`}
                    onClick={() => {
                      setCenterTab('spending')
                      setActiveDept(d.id)
                      window.setTimeout(() => {
                        document
                          .getElementById(`dept-row-${d.id}`)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }, 50)
                    }}
                  >
                    <span>{d.name}</span>
                    <em>{formatMoney(d.allocated)}</em>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <div className="center-panel">
          {centerTab === 'income' && (
            <IncomeTaxEditor
              gov={gov}
              incomeYield={proj.revenue.incomeTax}
              onPatch={patchGov}
            />
          )}
          {centerTab === 'optional' && (
            <OptionalTaxEditor
              taxes={gov.optionalTaxes}
              yields={proj.revenue.optional}
              onPatch={patchGov}
            />
          )}
          {centerTab === 'spending' && (
            <SpendingEditor
              gov={gov}
              activeId={activeDept}
              statuses={proj.deptStatus}
              onPatch={patchGov}
              onSelect={setActiveDept}
            />
          )}
        </div>

        <aside className="summary-panel">
          <h3>Live summary</h3>
          <SummaryBlock title="Where the money comes from">
            <Row label="Total revenue" value={formatMoney(proj.revenue.total)} bold />
            <Row
              label="↳ Income tax (people)"
              value={formatMoney(proj.revenue.incomeTax)}
            />
            <Row
              label="↳ Other general taxes"
              value={formatMoney(
                proj.revenue.general - proj.revenue.incomeTax - proj.revenue.federalGrant,
              )}
            />
            {proj.revenue.federalGrant > 0 && (
              <Row
                label="↳ Federal grants"
                value={formatMoney(proj.revenue.federalGrant)}
              />
            )}
            <Row
              label="General (spend anywhere)"
              value={formatMoney(proj.revenue.general)}
              bold
            />
            <Row
              label="Dedicated (trust funds only)"
              value={formatMoney(proj.revenue.dedicated)}
              bold
            />
          </SummaryBlock>
          <SummaryBlock title="Expenditure">
            <Row label="Total" value={formatMoney(proj.spending.total)} bold />
            <Row label="Mandatory" value={formatMoney(proj.spending.mandatory)} />
            <Row label="Discretionary" value={formatMoney(proj.spending.discretionary)} />
            <Row label="Net interest" value={formatMoney(proj.spending.netInterest)} />
            <Row label="Paid from trust funds" value={formatMoney(proj.spending.fromTrustFunds)} />
            <Row label="Paid from general" value={formatMoney(proj.spending.fromGeneral)} />
          </SummaryBlock>
          <SummaryBlock title="Budget status">
            <Row
              label={proj.balance >= 0 ? 'Surplus' : 'Deficit'}
              value={formatMoney(Math.abs(proj.balance))}
              tone={proj.balance >= 0 ? 'pos' : 'neg'}
            />
            <Row label="Treasury cash" value={formatMoney(gov.treasury.balance)} />
            <Row label="National debt" value={formatMoney(gov.treasury.nationalDebt)} />
            <Row label="Debt / GDP" value={formatPct(proj.debtToGdp, 0)} />
            <Row
              label="GDP growth (last close)"
              value={formatPct(growth)}
              tone={growth > 0 ? 'pos' : growth < 0 ? 'neg' : undefined}
            />
          </SummaryBlock>
          <SummaryBlock title="Trust funds">
            <p className="summary-help">
              Locked piggy banks. Dedicated taxes fill them; linked programs draw from them first.
            </p>
            {proj.spending.trustFundBalances.map((t) => (
              <Row key={t.id} label={t.name} value={formatMoney(t.balance)} />
            ))}
          </SummaryBlock>
        </aside>
      </div>

      <div className="workspace-actions">
        {!membershipReady && (
          <p className="submit-warn">
            Record Discord joins on the Admin Dashboard before submitting this
            FY.
          </p>
        )}
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (
              confirm(
                'Proportionally cut discretionary departments to close the deficit gap?',
              )
            ) {
              onChange((prev) => balanceBudget(prev, govId))
            }
          }}
        >
          Balance Budget
        </button>
        <button
          type="button"
          className="btn primary large"
          disabled={!membershipReady}
          onClick={() => {
            try {
              onChange((prev) => submitBudget(prev))
            } catch (err) {
              alert(err instanceof Error ? err.message : String(err))
            }
          }}
        >
          Submit FY{gov.period.fiscalYear} budget to Congress
        </button>
      </div>
    </section>
  )
}

function IncomeTaxEditor({
  gov,
  incomeYield,
  onPatch,
}: {
  gov: EconomyState['governments'][GovId]
  incomeYield: number
  onPatch: (fn: (g: typeof gov) => void) => void
}) {
  const setBracket = (i: number, patch: Partial<TaxBracket>) => {
    onPatch((g) => {
      g.incomeTax.brackets[i] = { ...g.incomeTax.brackets[i], ...patch }
    })
  }

  const prevCeiling = (i: number) => {
    if (i === 0) return 0
    return gov.incomeTax.brackets[i - 1]?.upTo ?? 0
  }

  return (
    <div className="editor">
      <h3>Income tax</h3>
      <p className="panel-note">
        Choose flat (one rate for everyone) or progressive (higher income pays
        a higher marginal rate). Bracket cutoffs are annual taxable income in
        whole dollars — e.g. $12,000, $49,000.
      </p>
      <div className="mode-toggle">
        <button
          type="button"
          className={gov.incomeTax.mode === 'flat' ? 'active' : ''}
          onClick={() => onPatch((g) => { g.incomeTax.mode = 'flat' })}
        >
          Flat
        </button>
        <button
          type="button"
          className={gov.incomeTax.mode === 'progressive' ? 'active' : ''}
          onClick={() => onPatch((g) => { g.incomeTax.mode = 'progressive' })}
        >
          Progressive
        </button>
      </div>
      <p className="yield-line">
        Projected income tax yield: <strong>{formatMoney(incomeYield)}</strong>
      </p>
      {gov.incomeTax.mode === 'flat' ? (
        <label className="field">
          <span>Flat rate <em>{formatPct(gov.incomeTax.flatRate)}</em></span>
          <input
            type="range"
            min={0}
            max={0.4}
            step={0.005}
            value={gov.incomeTax.flatRate}
            onChange={(e) =>
              onPatch((g) => {
                g.incomeTax.flatRate = Number(e.target.value)
              })
            }
          />
        </label>
      ) : (
        <table className="spread">
          <thead>
            <tr>
              <th>Income range</th>
              <th>Top of bracket ($)</th>
              <th>Marginal rate</th>
            </tr>
          </thead>
          <tbody>
            {gov.incomeTax.brackets.map((b, i) => {
              const from = prevCeiling(i)
              const rangeLabel =
                b.upTo === null
                  ? `Over $${from.toLocaleString('en-US')}`
                  : `$${from.toLocaleString('en-US')} – $${b.upTo.toLocaleString('en-US')}`
              return (
                <tr key={i}>
                  <td>
                    <strong>{rangeLabel}</strong>
                    <div className="tiny">Bracket {i + 1}</div>
                  </td>
                  <td>
                    {b.upTo === null ? (
                      <em>No limit (top bracket)</em>
                    ) : (
                      <div className="cell-input bracket-ceiling">
                        <span>$</span>
                        <input
                          type="number"
                          value={b.upTo}
                          step={1000}
                          min={from + 1000}
                          onChange={(e) =>
                            setBracket(i, {
                              upTo: Math.round(Number(e.target.value) / 1000) * 1000,
                            })
                          }
                        />
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="cell-input">
                      <input
                        type="number"
                        step={0.1}
                        value={Number((b.rate * 100).toFixed(1))}
                        onChange={(e) =>
                          setBracket(i, {
                            rate: Math.max(0, Number(e.target.value) / 100),
                          })
                        }
                      />
                      <span>%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="deduction-row">
        <label className="field">
          <span>
            Standard deduction <em>${gov.incomeTax.standardDeduction.toLocaleString('en-US')}</em>
          </span>
          <p className="field-help">
            A flat amount every filer can subtract from income before tax is
            calculated — the portion of earnings that is tax-free. Raising it
            means less taxable income and lower revenue (real U.S. single
            filer is about $15,000).
          </p>
          <input
            type="number"
            step={500}
            min={0}
            value={gov.incomeTax.standardDeduction}
            onChange={(e) =>
              onPatch((g) => {
                g.incomeTax.standardDeduction = Math.max(
                  0,
                  Math.round(Number(e.target.value) / 100) * 100,
                )
              })
            }
          />
        </label>
        <label className="field">
          <span>
            Personal exemption <em>${gov.incomeTax.personalExemption.toLocaleString('en-US')}</em>
          </span>
          <p className="field-help">
            Extra tax-free amount per person claimed on a return (you, spouse,
            dependents). Set to $0 to match current U.S. federal law; set
            something like $4,000 if your sim brings exemptions back.
          </p>
          <input
            type="number"
            step={500}
            min={0}
            value={gov.incomeTax.personalExemption}
            onChange={(e) =>
              onPatch((g) => {
                g.incomeTax.personalExemption = Math.max(
                  0,
                  Math.round(Number(e.target.value) / 100) * 100,
                )
              })
            }
          />
        </label>
      </div>
    </div>
  )
}

function OptionalTaxEditor({
  taxes,
  yields,
  onPatch,
}: {
  taxes: OptionalTax[]
  yields: { id: string; amount: number }[]
  onPatch: (fn: (g: EconomyState['governments'][GovId]) => void) => void
}) {
  return (
    <div className="editor">
      <h3>Optional taxes</h3>
      <p className="panel-note">
        Turn a tax <strong>on</strong> to collect it. Defaults match real U.S.
        practice where possible (e.g. no federal sales tax, payroll locked to
        Social Security / Medicare).
      </p>
      <div className="rev-key">
        <div>
          <strong>General</strong>
          <span>Goes into the main budget — spend on any department.</span>
        </div>
        <div>
          <strong>Dedicated</strong>
          <span>Locked to a trust fund — only pays that linked program.</span>
        </div>
        <div>
          <strong>Income tax</strong>
          <span>Separate tab — tax on people’s income (not listed here).</span>
        </div>
      </div>
      <div className="optional-list">
        {taxes.map((t, idx) => {
          const y = yields.find((x) => x.id === t.id)?.amount ?? 0
          return (
            <article
              key={t.id}
              className={`optional-card ${t.enacted ? 'on' : 'off'}`}
            >
              <header className="optional-card-top">
                <div>
                  <h4>{t.name}</h4>
                  <span className={`dest-pill ${t.dedicated ? 'ded' : 'gen'}`}>
                    {t.dedicated ? 'Dedicated' : 'General'}
                  </span>
                </div>
                <div className="on-off" role="group" aria-label={`${t.name} on or off`}>
                  <button
                    type="button"
                    className={t.enacted ? 'active on' : ''}
                    onClick={() =>
                      onPatch((g) => {
                        g.optionalTaxes[idx].enacted = true
                      })
                    }
                  >
                    On
                  </button>
                  <button
                    type="button"
                    className={!t.enacted ? 'active off' : ''}
                    onClick={() =>
                      onPatch((g) => {
                        g.optionalTaxes[idx].enacted = false
                      })
                    }
                  >
                    Off
                  </button>
                </div>
              </header>
              <p className="optional-desc">{t.description}</p>
              <p className="optional-dest">{t.destination}</p>
              <div className="optional-controls">
                <label className="field">
                  <span>
                    Rate{' '}
                    <em>
                      {t.base === 'perUnit'
                        ? `$${t.rate}`
                        : formatPct(t.rate, t.rate < 0.02 ? 2 : 1)}
                    </em>
                  </span>
                  {t.base === 'perUnit' ? (
                    <div className={`cell-input ${t.enacted ? '' : 'disabled'}`}>
                      <span>$</span>
                      <input
                        type="number"
                        step={0.01}
                        disabled={!t.enacted}
                        value={t.rate}
                        onChange={(e) =>
                          onPatch((g) => {
                            g.optionalTaxes[idx].rate = Number(e.target.value)
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className={`cell-input ${t.enacted ? '' : 'disabled'}`}>
                      <input
                        type="number"
                        step={0.1}
                        disabled={!t.enacted}
                        value={Number((t.rate * 100).toFixed(2))}
                        onChange={(e) =>
                          onPatch((g) => {
                            g.optionalTaxes[idx].rate =
                              Number(e.target.value) / 100
                          })
                        }
                      />
                      <span>%</span>
                    </div>
                  )}
                </label>
                <div className="optional-yield">
                  <span>Annual yield</span>
                  <strong>{t.enacted ? formatMoney(y) : '—'}</strong>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function SpendingEditor({
  gov,
  activeId,
  statuses,
  onPatch,
  onSelect,
}: {
  gov: EconomyState['governments'][GovId]
  activeId: string | null
  statuses: ReturnType<typeof projectBudget>['deptStatus']
  onPatch: (fn: (g: typeof gov) => void) => void
  onSelect: (id: string) => void
}) {
  return (
    <div className="editor">
      <h3>All departments</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Set each line’s annual funding here. Baseline grows with GDP each year.
        Descriptions are under each department name.
      </p>
      <table className="spread dept-spread">
        <thead>
          <tr>
            <th>Department</th>
            <th>Baseline</th>
            <th>Status</th>
            <th className="num">Allocated ($B / yr)</th>
          </tr>
        </thead>
        <tbody>
          {gov.departments.map((row) => {
            const s = statuses.find((x) => x.id === row.id)
            const selected = row.id === activeId
            return (
              <tr
                key={row.id}
                id={`dept-row-${row.id}`}
                className={selected ? 'dept-row-active' : ''}
                onClick={() => onSelect(row.id)}
              >
                <td className="dept-cell">
                  <strong>{row.name}</strong>
                  <div className="tiny">{row.type}</div>
                  <p className="dept-row-desc">{row.description}</p>
                  {selected && (
                    <label className="field dept-inline-slider">
                      <span>
                        Adjust <em>{formatMoney(row.allocated)}</em>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(row.baseline * 2, row.allocated * 1.5, 1e9)}
                        step={1e8}
                        value={row.allocated}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation()
                          const v = Number(e.target.value)
                          onPatch((g) => {
                            const target = g.departments.find((x) => x.id === row.id)
                            if (target) target.allocated = v
                          })
                        }}
                      />
                    </label>
                  )}
                </td>
                <td className="mono muted">{formatMoney(row.baseline)}</td>
                <td>
                  <span
                    className={`fund-pill ${s?.status === 'Below baseline' ? 'under' : s?.status === 'Above baseline' ? 'boost' : 'ok'}`}
                  >
                    {s?.status}
                  </span>
                </td>
                <td className="num" onClick={(e) => e.stopPropagation()}>
                  <div className="cell-input billion">
                    <input
                      type="number"
                      step={1}
                      min={0}
                      value={Number((row.allocated / 1e9).toFixed(1))}
                      onChange={(e) =>
                        onPatch((g) => {
                          const target = g.departments.find((x) => x.id === row.id)
                          if (target)
                            target.allocated = Number(e.target.value) * 1e9
                        })
                      }
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg'
}) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  )
}

function SummaryBlock({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="summary-block">
      <h4>{title}</h4>
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string
  value: string
  bold?: boolean
  tone?: 'pos' | 'neg'
}) {
  return (
    <div className={`sum-row ${bold ? 'bold' : ''}`}>
      <span>{label}</span>
      <strong className={`mono ${tone ?? ''}`}>{value}</strong>
    </div>
  )
}
