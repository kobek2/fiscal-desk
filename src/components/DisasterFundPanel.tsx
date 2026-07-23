import { useState, type Dispatch, type SetStateAction } from 'react'
import type { EconomyState } from '../economy'
import {
  drawDisasterRelief,
  emergencyCongressionalFunding,
  formatMoney,
  formatPct,
  getDisasterFundBalance,
  severityGuide,
} from '../economy'

interface Props {
  state: EconomyState
  onChange: Dispatch<SetStateAction<EconomyState>>
}

export function DisasterFundPanel({ state, onChange }: Props) {
  const balance = getDisasterFundBalance(state)
  const guide = severityGuide(balance)
  const [drawB, setDrawB] = useState('')
  const [drawNote, setDrawNote] = useState('')
  const [emergB, setEmergB] = useState('')
  const [emergNote, setEmergNote] = useState('')

  const drawAmount = Math.max(0, Number(drawB) || 0) * 1e9
  const emergAmount = Math.max(0, Number(emergB) || 0) * 1e9

  return (
    <section className="panel disaster-panel">
      <header>
        <p className="eyebrow">Federal · tracking only</p>
        <h2>Disaster Relief Trust Fund</h2>
        <p className="panel-note">
          This fund is <strong>one piece</strong> of clearing an RP event. Each
          new fiscal year the fund is reset to whatever Congress approved for
          Disaster Relief in the <strong>previous</strong> year. Severity
          guidance below is a % of that pot.
        </p>
      </header>

      <div className="disaster-balance">
        <span>Available (sized from prior-year appropriation)</span>
        <strong>{formatMoney(balance)}</strong>
        <em className="disaster-prior">
          Prior FY Disaster Relief approved:{' '}
          {formatMoney(state.governments.federal.priorYearDisasterAppropriation)}
        </em>
      </div>

      <div className="severity-guide">
        <p className="eyebrow">Suggested draw vs current reserves</p>
        <p className="hint" style={{ marginTop: 0 }}>
          Use these as Discord guidance when writing the news story — not as an
          auto-resolver. Severe ≈ 20% of the fund; smaller events use less.
        </p>
        <table className="spread">
          <thead>
            <tr>
              <th>Severity</th>
              <th>% of fund</th>
              <th className="num">≈ dollars now</th>
            </tr>
          </thead>
          <tbody>
            {guide.map((g) => (
              <tr key={g.key}>
                <td>{g.label}</td>
                <td className="mono">{formatPct(g.share, 0)}</td>
                <td className="num mono">{formatMoney(g.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="disaster-actions">
        <div className="disaster-box">
          <h3>Presidential draw</h3>
          <p className="hint">
            One-line entry after the President approves a relief amount. Lowers
            the trust fund and posts to the ledger.
          </p>
          <label className="field">
            <span>Amount ($B)</span>
            <input
              type="number"
              step={0.1}
              min={0}
              placeholder="e.g. 12"
              value={drawB}
              onChange={(e) => setDrawB(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Note (optional)</span>
            <input
              type="text"
              placeholder="Western wildfires — Major"
              value={drawNote}
              onChange={(e) => setDrawNote(e.target.value)}
            />
          </label>
          {drawAmount > balance && balance >= 0 && (
            <p className="hint warn-text">
              Only {formatMoney(balance)} is in the fund. The rest needs
              emergency congressional funding.
            </p>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={drawAmount <= 0}
            onClick={() => {
              onChange((prev) =>
                drawDisasterRelief(prev, drawAmount, drawNote),
              )
              setDrawB('')
              setDrawNote('')
            }}
          >
            Record draw → ledger
          </button>
        </div>

        <div className="disaster-box emergency">
          <h3>Emergency congressional funding</h3>
          <p className="hint">
            When the trust fund can’t cover it, Congress borrows. This{' '}
            <strong>adds to national debt</strong> and logs the expenditure —
            it does not refill the trust fund.
          </p>
          <label className="field">
            <span>Amount ($B)</span>
            <input
              type="number"
              step={0.1}
              min={0}
              placeholder="e.g. 25"
              value={emergB}
              onChange={(e) => setEmergB(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Note (optional)</span>
            <input
              type="text"
              placeholder="Supplemental after fund depleted"
              value={emergNote}
              onChange={(e) => setEmergNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn danger"
            disabled={emergAmount <= 0}
            onClick={() => {
              onChange((prev) =>
                emergencyCongressionalFunding(prev, emergAmount, emergNote),
              )
              setEmergB('')
              setEmergNote('')
            }}
          >
            Record emergency funding → debt + ledger
          </button>
        </div>
      </div>
    </section>
  )
}
