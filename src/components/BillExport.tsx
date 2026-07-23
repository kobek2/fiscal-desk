import { useMemo, useState } from 'react'
import type { EconomyState, GovId } from '../economy'
import {
  budgetFingerprint,
  createBillDraft,
  draftBalance,
  draftDebtToGdp,
  draftDeptOutlays,
  draftRevenueChartData,
  draftSpendingChartData,
  formatMoney,
  formatPct,
  type BillDraft,
} from '../economy'
import { BalanceMeter, RevenueDonut, SpendingBars } from './BillCharts'
import {
  copyBillForGoogleDocs,
  openBillForGoogleDocs,
} from './copyForGoogleDocs'

interface Props {
  state: EconomyState
  govId: GovId
}

export function BillExport({ state, govId }: Props) {
  const gov = state.governments[govId]
  const liveFp = budgetFingerprint(gov)

  const [sponsor, setSponsor] = useState('Rep. _______________')
  const [cosponsors, setCosponsors] = useState('')
  const [billNumber, setBillNumber] = useState('H.R. 1')
  const [draft, setDraft] = useState<BillDraft | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)

  const stale = draft != null && draft.fingerprint !== liveFp

  const revData = useMemo(
    () => (draft ? draftRevenueChartData(draft) : []),
    [draft],
  )
  const spendData = useMemo(
    () => (draft ? draftSpendingChartData(draft) : []),
    [draft],
  )
  const balance = draft ? draftBalance(draft) : 0
  const debtToGdp = draft ? draftDebtToGdp(draft) : 0
  const outlays = draft ? draftDeptOutlays(draft) : { baseline: 0, allocated: 0 }
  const priorFy = draft ? draft.fy - 1 : gov.period.fiscalYear - 1

  const generate = () => {
    setDraft(
      createBillDraft(gov, {
        sponsor,
        cosponsors,
        billNumber,
      }),
    )
    setExportNote(null)
  }

  const copyForDocs = async () => {
    if (!draft) return
    setExportBusy(true)
    setExportNote(null)
    try {
      await copyBillForGoogleDocs(draft)
      setExportNote(
        'Copied with formatting + charts. Open a Google Doc and paste (Ctrl/Cmd+V). If charts are missing, use Open for Google Docs → Select All → Copy → Paste.',
      )
    } catch (err) {
      setExportNote(
        err instanceof Error ? err.message : 'Copy failed — try Open for Google Docs.',
      )
    } finally {
      setExportBusy(false)
    }
  }

  const openForDocs = () => {
    if (!draft) return
    setExportNote(null)
    try {
      openBillForGoogleDocs(draft)
      setExportNote(
        'Opened a formatted page. Select All → Copy, then paste into Google Docs.',
      )
    } catch (err) {
      setExportNote(err instanceof Error ? err.message : 'Could not open tab.')
    }
  }

  return (
    <section className="panel bill-export">
      <header className="no-print">
        <p className="eyebrow">Official submission</p>
        <h2>House budget bill</h2>
        <p className="panel-note">
          Generate the bill, then <strong>Copy for Google Docs</strong> (or Open
          for Google Docs → Select All → Copy). Paste into a blank Doc — tables,
          headings, and charts go with it.
        </p>
      </header>

      <div className="bill-meta-fields no-print">
        <label className="field">
          <span>Bill number</span>
          <input
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
            placeholder="H.R. 1"
          />
        </label>
        <label className="field">
          <span>Sponsor</span>
          <input value={sponsor} onChange={(e) => setSponsor(e.target.value)} />
        </label>
        <label className="field">
          <span>Co-Sponsors</span>
          <input
            value={cosponsors}
            placeholder="Rep. names"
            onChange={(e) => setCosponsors(e.target.value)}
          />
        </label>
      </div>

      <div className="bill-actions no-print">
        <button type="button" className="btn primary" onClick={generate}>
          {draft ? 'Regenerate from budget' : 'Generate bill'}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={!draft || exportBusy}
          onClick={() => void copyForDocs()}
        >
          {exportBusy ? 'Copying…' : 'Copy for Google Docs'}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={!draft}
          onClick={openForDocs}
        >
          Open for Google Docs
        </button>
      </div>
      {exportNote && (
        <p className="bill-export-note no-print" role="status">
          {exportNote}
        </p>
      )}

      {stale && (
        <p className="bill-stale no-print" role="status">
          Budget numbers changed since this bill was generated. Regenerate to
          refresh the packet.
        </p>
      )}

      {!draft ? (
        <div className="bill-empty no-print">
          <p>
            No bill yet. Punch in the budget above, set sponsor lines, then hit{' '}
            <strong>Generate bill</strong>.
          </p>
        </div>
      ) : (
        <BillPreview
          draft={draft}
          revData={revData}
          spendData={spendData}
          balance={balance}
          debtToGdp={debtToGdp}
          outlays={outlays}
          priorFy={priorFy}
        />
      )}
    </section>
  )
}

function BillPreview({
  draft,
  revData,
  spendData,
  balance,
  debtToGdp,
  outlays,
  priorFy,
}: {
  draft: BillDraft
  revData: ReturnType<typeof draftRevenueChartData>
  spendData: ReturnType<typeof draftSpendingChartData>
  balance: number
  debtToGdp: number
  outlays: { baseline: number; allocated: number }
  priorFy: number
}) {
  return (
    <article className="bill-packet" id="bill-packet">
      <header className="bill-cover">
        <p className="bill-congress">
          {draft.congress}
          <br />
          {draft.session}
        </p>
        <p className="bill-number">{draft.billNumber}</p>
        <h1 className="bill-title">{draft.shortTitle}</h1>
        <hr className="bill-rule" />
        <p className="bill-chamber">{draft.chamber}</p>
        <p className="bill-year">{draft.fy}</p>
        <div className="bill-sponsors">
          <p>
            <span className="received">Received</span>
          </p>
          <p className="sponsor-line">Sponsor: {draft.sponsor}</p>
          <p className="sponsor-line">
            Co-Sponsors: {draft.cosponsors || '________________'}
          </p>
        </div>
        <div className="bill-purpose-box">
          <p>{draft.purpose}</p>
        </div>
      </header>

      <div className="bill-body-start">
        <h2 className="a-bill">A BILL</h2>
        <p className="bill-purpose-repeat">{draft.purpose}</p>
        <p className="enacting-clause">{draft.enacting}</p>
      </div>

      <section className="bill-sec">
        <h3>SECTION 1. SHORT TITLE.</h3>
        <p>This Act may be cited as the “{draft.shortTitle}”.</p>
      </section>

      <section className="bill-sec">
        <h3>SEC. 2. FINDINGS.</h3>
        <p>Congress finds the following:</p>
        <ol className="bill-findings">
          <li>
            Estimated GDP for Fiscal Year {draft.fy}:{' '}
            <strong>{formatMoney(draft.gdp)}</strong>.
          </li>
          <li>
            Population approximately {draft.population.toLocaleString('en-US')};
            unemployment {formatPct(draft.unemploymentRate)}.
          </li>
          <li>
            Public debt <strong>{formatMoney(draft.nationalDebt)}</strong> (
            {formatPct(debtToGdp)} of GDP).
          </li>
          <li>
            Fiscal stance under this Act: <strong>{draft.fiscalStance}</strong>.
          </li>
          <li>
            Assumed GDP growth: {formatPct(draft.gdpGrowth)} annualized.
          </li>
        </ol>
      </section>

      <section className="bill-sec bill-charts">
        <h3>SEC. 3. BUDGETARY OVERVIEW (CHARTS).</h3>
        <div className="charts-grid">
          <RevenueDonut data={revData} />
          <BalanceMeter
            revenue={draft.revenueTotal}
            spending={draft.spendingTotal}
            balance={balance}
          />
        </div>
        <SpendingBars data={spendData} />
      </section>

      <section className="bill-sec">
        <h3>SEC. 4. BUDGET TRACKING: FISCAL YEAR {draft.fy}.</h3>
        <table className="tracking-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Baseline (FY{priorFy})</th>
              <th>Allocation (FY{draft.fy})</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {draft.departments.map((d, i) => {
              const change = d.allocated - d.baseline
              return (
                <tr key={d.id} className={i % 2 === 1 ? 'alt' : ''}>
                  <td>
                    <strong>{d.name}</strong>
                    <span className="cat-type">{d.type}</span>
                  </td>
                  <td>{formatMoney(d.baseline)}</td>
                  <td>{formatMoney(d.allocated)}</td>
                  <td className={change >= 0 ? 'pos' : 'neg'}>
                    {change >= 0 ? '+' : ''}
                    {formatMoney(change)}
                  </td>
                </tr>
              )
            })}
            <tr className="sep">
              <td colSpan={4} />
            </tr>
            <tr className="total-line">
              <td>
                <strong>Total departmental outlays</strong>
              </td>
              <td>{formatMoney(outlays.baseline)}</td>
              <td>{formatMoney(outlays.allocated)}</td>
              <td />
            </tr>
            <tr className="total-line">
              <td>
                <strong>Total revenue</strong>
              </td>
              <td />
              <td>{formatMoney(draft.revenueTotal)}</td>
              <td />
            </tr>
            <tr className="total-line">
              <td>
                <strong>Total spending</strong>
              </td>
              <td />
              <td>{formatMoney(draft.spendingTotal)}</td>
              <td />
            </tr>
            <tr className="total-line">
              <td>
                <strong>
                  {balance >= 0 ? 'Total budget surplus' : 'Total budget deficit'}
                </strong>
              </td>
              <td />
              <td className={balance >= 0 ? 'pos' : 'neg'}>
                {formatMoney(Math.abs(balance))}
              </td>
              <td />
            </tr>
            <tr className="total-line">
              <td>
                <strong>Total debt</strong>
              </td>
              <td />
              <td>{formatMoney(draft.nationalDebt)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </section>

      <section className="bill-sec">
        <h3>SEC. 5. REVENUE AUTHORITIES.</h3>
        <p>
          <strong>(a) Income tax.</strong> Mode: {draft.incomeTaxMode}. Estimated
          yield: {formatMoney(draft.incomeTaxYield)}.
        </p>
        {draft.incomeTaxMode === 'progressive' ? (
          <ul className="bracket-list">
            {draft.brackets.map((b, i) => (
              <li key={i}>
                {b.label} at {formatPct(b.rate)}
              </li>
            ))}
          </ul>
        ) : (
          <p>Flat rate: {formatPct(draft.flatRate)}.</p>
        )}
        <p>
          <strong>(b) Other enacted taxes.</strong>
        </p>
        <ul className="bracket-list">
          {draft.optionalTaxes.length === 0 ? (
            <li>None enacted.</li>
          ) : (
            draft.optionalTaxes.map((t) => (
              <li key={t.id}>
                {t.name}: {t.rateLabel} → {formatMoney(t.yield)} (
                {t.dedicated ? 'dedicated' : 'general'})
              </li>
            ))
          )}
        </ul>
        <p>
          <strong>(c) Revenue totals.</strong> General{' '}
          {formatMoney(draft.revenueGeneral)}; dedicated{' '}
          {formatMoney(draft.revenueDedicated)}; total{' '}
          {formatMoney(draft.revenueTotal)}.
        </p>
      </section>

      <section className="bill-sec">
        <h3>SEC. 6. TRUST FUNDS.</h3>
        <ul className="bracket-list">
          {draft.trustFunds.map((t) => (
            <li key={t.id}>
              {t.name}: {formatMoney(t.balance)}
            </li>
          ))}
        </ul>
      </section>

      <section className="bill-sec">
        <h3>SEC. 7. EFFECTIVE DATE.</h3>
        <p>
          This Act shall take effect on October 1, {draft.fy - 1}, or upon
          enactment, whichever is later, and shall apply to Fiscal Year{' '}
          {draft.fy}.
        </p>
      </section>

      <p className="bill-end">— end of bill —</p>
    </article>
  )
}
