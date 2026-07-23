import {
  draftBalance,
  draftDebtToGdp,
  draftDeptOutlays,
  draftRevenueChartData,
  draftSpendingChartData,
  formatDraftText,
  formatMoney,
  formatPct,
  type BillDraft,
} from '../economy'

function canvasPng(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#fffef8'
  ctx.fillRect(0, 0, w, h)
  draw(ctx, w, h)
  return canvas.toDataURL('image/png')
}

function drawRevenueDonut(draft: BillDraft): string {
  const data = draftRevenueChartData(draft)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  return canvasPng((ctx, _w, h) => {
    const cx = 110
    const cy = h / 2
    const r = 72
    let angle = -Math.PI / 2
    for (const d of data) {
      const sweep = (d.value / total) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, angle, angle + sweep)
      ctx.closePath()
      ctx.fillStyle = d.color
      ctx.fill()
      angle += sweep
    }
    ctx.beginPath()
    ctx.arc(cx, cy, 40, 0, Math.PI * 2)
    ctx.fillStyle = '#fffef8'
    ctx.fill()
    ctx.fillStyle = '#333'
    ctx.font = '12px Times New Roman, Times, serif'
    ctx.textAlign = 'center'
    ctx.fillText('Total', cx, cy - 4)
    ctx.font = 'bold 13px Times New Roman, Times, serif'
    ctx.fillText(formatMoney(total), cx, cy + 14)

    let ly = 36
    ctx.textAlign = 'left'
    ctx.font = '13px Times New Roman, Times, serif'
    for (const d of data) {
      ctx.fillStyle = d.color
      ctx.fillRect(210, ly - 10, 12, 12)
      ctx.fillStyle = '#222'
      ctx.fillText(
        `${d.name}: ${formatMoney(d.value)} (${formatPct(d.value / total, 0)})`,
        230,
        ly,
      )
      ly += 28
    }
  }, 520, 200)
}

function drawBalanceMeter(draft: BillDraft): string {
  const revenue = draft.revenueTotal
  const spending = draft.spendingTotal
  const balance = draftBalance(draft)
  const max = Math.max(revenue, spending, 1)
  return canvasPng((ctx, w) => {
    ctx.fillStyle = '#222'
    ctx.font = 'bold 16px Times New Roman, Times, serif'
    ctx.fillText('Budget balance', 16, 28)

    const barX = 100
    const barW = w - 220
    const row = (label: string, value: number, color: string, y: number) => {
      ctx.fillStyle = '#333'
      ctx.font = '13px Times New Roman, Times, serif'
      ctx.fillText(label, 16, y + 12)
      ctx.fillStyle = '#efeae2'
      ctx.fillRect(barX, y, barW, 16)
      ctx.fillStyle = color
      ctx.fillRect(barX, y, (value / max) * barW, 16)
      ctx.fillStyle = '#111'
      ctx.font = 'bold 13px IBM Plex Mono, monospace'
      ctx.fillText(formatMoney(value), barX + barW + 12, y + 13)
    }
    row('Revenue', revenue, '#1f6f5b', 50)
    row('Spending', spending, '#a33b2b', 90)

    ctx.font = 'bold 15px Times New Roman, Times, serif'
    ctx.fillStyle = balance >= 0 ? '#1d6b45' : '#9b1d1d'
    ctx.fillText(
      `${balance >= 0 ? 'Projected surplus' : 'Projected deficit'}: ${formatMoney(Math.abs(balance))}`,
      16,
      150,
    )
  }, 560, 180)
}

function drawSpendingBars(draft: BillDraft): string {
  const rows = [...draftSpendingChartData(draft)]
    .sort((a, b) => b.allocated - a.allocated)
    .slice(0, 10)
  const max = Math.max(...rows.map((d) => Math.max(d.baseline, d.allocated)), 1)
  const rowH = 28
  const h = 48 + rows.length * rowH
  return canvasPng((ctx, w) => {
    ctx.fillStyle = '#222'
    ctx.font = 'bold 16px Times New Roman, Times, serif'
    ctx.fillText('Department funding vs baseline (top 10)', 16, 28)
    ctx.font = '11px Times New Roman, Times, serif'
    ctx.fillStyle = '#666'
    ctx.fillText('Gray = baseline · Green = allocation', 16, 46)

    rows.forEach((d, i) => {
      const y = 58 + i * rowH
      ctx.fillStyle = '#333'
      ctx.font = '12px Times New Roman, Times, serif'
      ctx.textAlign = 'right'
      ctx.fillText(d.short, 150, y + 12)
      ctx.textAlign = 'left'
      const trackX = 160
      const trackW = w - 280
      ctx.fillStyle = '#f0ebe3'
      ctx.fillRect(trackX, y, trackW, 18)
      ctx.fillStyle = '#b7b1a6'
      ctx.fillRect(trackX, y, (d.baseline / max) * trackW, 8)
      ctx.fillStyle = '#1f6f5b'
      ctx.fillRect(trackX, y + 9, (d.allocated / max) * trackW, 8)
      ctx.fillStyle = '#111'
      ctx.font = '11px IBM Plex Mono, monospace'
      ctx.fillText(formatMoney(d.allocated), trackX + trackW + 8, y + 13)
    })
  }, 640, h)
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Google Docs–friendly HTML: real tables + chart images as data URLs. */
export function buildBillHtmlForGoogleDocs(draft: BillDraft): string {
  const balance = draftBalance(draft)
  const debtToGdp = draftDebtToGdp(draft)
  const outlays = draftDeptOutlays(draft)
  const priorFy = draft.fy - 1
  const donut = drawRevenueDonut(draft)
  const meter = drawBalanceMeter(draft)
  const bars = drawSpendingBars(draft)

  const deptRows = draft.departments
    .map((d, i) => {
      const change = d.allocated - d.baseline
      const bg = i % 2 === 1 ? '#f5f2eb' : '#ffffff'
      const chColor = change >= 0 ? '#1d6b45' : '#9b1d1d'
      const chSign = change >= 0 ? '+' : ''
      return `<tr style="background:${bg}">
        <td style="padding:6px 8px;border:1px solid #ccc"><b>${esc(d.name)}</b><br><span style="color:#666;font-size:10pt">${esc(d.type)}</span></td>
        <td style="padding:6px 8px;border:1px solid #ccc">${esc(formatMoney(d.baseline))}</td>
        <td style="padding:6px 8px;border:1px solid #ccc">${esc(formatMoney(d.allocated))}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;color:${chColor}">${chSign}${esc(formatMoney(change))}</td>
      </tr>`
    })
    .join('')

  const brackets =
    draft.incomeTaxMode === 'progressive'
      ? `<ul>${draft.brackets.map((b) => `<li>${esc(b.label)} at ${esc(formatPct(b.rate))}</li>`).join('')}</ul>`
      : `<p>Flat rate: ${esc(formatPct(draft.flatRate))}.</p>`

  const optional =
    draft.optionalTaxes.length === 0
      ? '<li>None enacted.</li>'
      : draft.optionalTaxes
          .map(
            (t) =>
              `<li>${esc(t.name)}: ${esc(t.rateLabel)} → ${esc(formatMoney(t.yield))} (${t.dedicated ? 'dedicated' : 'general'})</li>`,
          )
          .join('')

  const trusts = draft.trustFunds
    .map((t) => `<li>${esc(t.name)}: ${esc(formatMoney(t.balance))}</li>`)
    .join('')

  return `<!DOCTYPE html><html><body>
<div style="font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.45;color:#1a1a1a;max-width:700px">
  <p style="margin:0 0 8px">${esc(draft.congress)}<br>${esc(draft.session)}</p>
  <p style="text-align:center;font-size:18pt;font-weight:bold;margin:12px 0">${esc(draft.billNumber)}</p>
  <p style="text-align:center;font-size:16pt;font-weight:bold;margin:8px 0">${esc(draft.shortTitle)}</p>
  <hr style="border:none;border-top:1px solid #333;margin:12px 0" />
  <p style="text-align:center;letter-spacing:0.06em;font-weight:bold;margin:8px 0">${esc(draft.chamber)}</p>
  <p style="text-align:center;margin:4px 0">${draft.fy}</p>
  <p style="margin:12px 0 4px"><i>Received</i></p>
  <p style="text-align:center;margin:4px 0">Sponsor: ${esc(draft.sponsor)}</p>
  <p style="text-align:center;margin:4px 0 12px">Co-Sponsors: ${esc(draft.cosponsors || '________________')}</p>
  <p style="border-top:2px solid #222;border-bottom:2px solid #222;padding:10px 8px;text-align:center;font-weight:bold">${esc(draft.purpose)}</p>

  <p style="text-align:center;font-size:16pt;font-weight:bold;letter-spacing:0.12em;margin:24px 0 8px">A BILL</p>
  <p style="text-align:center">${esc(draft.purpose)}</p>
  <p style="text-align:center;font-weight:bold;font-style:italic;margin:12px 0 20px">${esc(draft.enacting)}</p>

  <p style="font-weight:bold;margin:18px 0 6px">SECTION 1. SHORT TITLE.</p>
  <p>This Act may be cited as the “${esc(draft.shortTitle)}”.</p>

  <p style="font-weight:bold;margin:18px 0 6px">SEC. 2. FINDINGS.</p>
  <p>Congress finds the following:</p>
  <ol>
    <li>Estimated GDP for Fiscal Year ${draft.fy}: <b>${esc(formatMoney(draft.gdp))}</b>.</li>
    <li>Population approximately ${draft.population.toLocaleString('en-US')}; unemployment ${esc(formatPct(draft.unemploymentRate))}.</li>
    <li>Public debt <b>${esc(formatMoney(draft.nationalDebt))}</b> (${esc(formatPct(debtToGdp))} of GDP).</li>
    <li>Fiscal stance under this Act: <b>${esc(draft.fiscalStance)}</b>.</li>
    <li>Assumed GDP growth: ${esc(formatPct(draft.gdpGrowth))} annualized.</li>
  </ol>

  <p style="font-weight:bold;margin:18px 0 6px">SEC. 3. BUDGETARY OVERVIEW (CHARTS).</p>
  <p>The following figures summarize the Fiscal Year ${draft.fy} proposal.</p>
  <p style="font-weight:bold;margin:12px 0 4px">Revenue mix</p>
  <p><img src="${donut}" width="480" height="185" alt="Revenue mix chart" /></p>
  <p style="font-weight:bold;margin:12px 0 4px">Budget balance</p>
  <p><img src="${meter}" width="520" height="165" alt="Budget balance chart" /></p>
  <p style="font-weight:bold;margin:12px 0 4px">Department funding vs baseline</p>
  <p><img src="${bars}" width="600" alt="Department funding chart" /></p>

  <p style="font-weight:bold;margin:18px 0 6px">SEC. 4. BUDGET TRACKING: FISCAL YEAR ${draft.fy}.</p>
  <p>Baseline (FY${priorFy} reference) compared with proposed FY${draft.fy} allocations.</p>
  <table style="border-collapse:collapse;width:100%;font-size:11pt;margin-top:8px">
    <thead>
      <tr style="background:#e8e2d6">
        <th style="padding:6px 8px;border:1px solid #ccc;text-align:left">Category</th>
        <th style="padding:6px 8px;border:1px solid #ccc;text-align:left">Baseline (FY${priorFy})</th>
        <th style="padding:6px 8px;border:1px solid #ccc;text-align:left">Allocation (FY${draft.fy})</th>
        <th style="padding:6px 8px;border:1px solid #ccc;text-align:left">Change</th>
      </tr>
    </thead>
    <tbody>
      ${deptRows}
      <tr><td colspan="4" style="height:8px;background:#ddd6c8;border:0"></td></tr>
      <tr>
        <td style="padding:6px 8px;border:1px solid #ccc"><b>Total departmental outlays</b></td>
        <td style="padding:6px 8px;border:1px solid #ccc">${esc(formatMoney(outlays.baseline))}</td>
        <td style="padding:6px 8px;border:1px solid #ccc">${esc(formatMoney(outlays.allocated))}</td>
        <td style="padding:6px 8px;border:1px solid #ccc"></td>
      </tr>
      <tr>
        <td style="padding:6px 8px;border:1px solid #ccc"><b>Total revenue</b></td>
        <td style="padding:6px 8px;border:1px solid #ccc"></td>
        <td style="padding:6px 8px;border:1px solid #ccc">${esc(formatMoney(draft.revenueTotal))}</td>
        <td style="padding:6px 8px;border:1px solid #ccc"></td>
      </tr>
      <tr>
        <td style="padding:6px 8px;border:1px solid #ccc"><b>Total spending</b></td>
        <td style="padding:6px 8px;border:1px solid #ccc"></td>
        <td style="padding:6px 8px;border:1px solid #ccc">${esc(formatMoney(draft.spendingTotal))}</td>
        <td style="padding:6px 8px;border:1px solid #ccc"></td>
      </tr>
      <tr>
        <td style="padding:6px 8px;border:1px solid #ccc"><b>${balance >= 0 ? 'Total budget surplus' : 'Total budget deficit'}</b></td>
        <td style="padding:6px 8px;border:1px solid #ccc"></td>
        <td style="padding:6px 8px;border:1px solid #ccc;color:${balance >= 0 ? '#1d6b45' : '#9b1d1d'}">${esc(formatMoney(Math.abs(balance)))}</td>
        <td style="padding:6px 8px;border:1px solid #ccc"></td>
      </tr>
      <tr>
        <td style="padding:6px 8px;border:1px solid #ccc"><b>Total debt</b></td>
        <td style="padding:6px 8px;border:1px solid #ccc"></td>
        <td style="padding:6px 8px;border:1px solid #ccc">${esc(formatMoney(draft.nationalDebt))}</td>
        <td style="padding:6px 8px;border:1px solid #ccc"></td>
      </tr>
    </tbody>
  </table>

  <p style="font-weight:bold;margin:18px 0 6px">SEC. 5. REVENUE AUTHORITIES.</p>
  <p><b>(a) Income tax.</b> Mode: ${esc(draft.incomeTaxMode)}. Estimated yield: ${esc(formatMoney(draft.incomeTaxYield))}.</p>
  ${brackets}
  <p>Standard deduction $${draft.standardDeduction.toLocaleString('en-US')}; personal exemption $${draft.personalExemption.toLocaleString('en-US')}.</p>
  <p><b>(b) Other enacted taxes.</b></p>
  <ul>${optional}</ul>
  <p><b>(c) Revenue totals.</b> General ${esc(formatMoney(draft.revenueGeneral))}; dedicated ${esc(formatMoney(draft.revenueDedicated))}; total ${esc(formatMoney(draft.revenueTotal))}.</p>

  <p style="font-weight:bold;margin:18px 0 6px">SEC. 6. TRUST FUNDS.</p>
  <ul>${trusts}</ul>
  ${
    draft.priorYearDisaster != null
      ? `<p>Disaster Relief Trust Fund sized from prior-year appropriation: ${esc(formatMoney(draft.priorYearDisaster))}.</p>`
      : ''
  }

  <p style="font-weight:bold;margin:18px 0 6px">SEC. 7. EFFECTIVE DATE.</p>
  <p>This Act shall take effect on October 1, ${draft.fy - 1}, or upon enactment, whichever is later, and shall apply to Fiscal Year ${draft.fy}.</p>

  <p style="text-align:center;font-style:italic;color:#555;margin-top:28px">— end of bill —</p>
</div>
</body></html>`
}

export async function copyBillForGoogleDocs(draft: BillDraft): Promise<void> {
  const html = buildBillHtmlForGoogleDocs(draft)
  const plain = formatDraftText(draft)

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ])
  } catch {
    // Fallback for browsers that reject multi-type ClipboardItem
    const wrapper = document.createElement('div')
    wrapper.contentEditable = 'true'
    wrapper.style.position = 'fixed'
    wrapper.style.left = '-9999px'
    wrapper.innerHTML = html
    document.body.appendChild(wrapper)
    const range = document.createRange()
    range.selectNodeContents(wrapper)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    const ok = document.execCommand('copy')
    sel?.removeAllRanges()
    wrapper.remove()
    if (!ok) {
      await navigator.clipboard.writeText(plain)
      throw new Error(
        'Copied plain text only — use “Open for Google Docs” so charts paste correctly.',
      )
    }
  }
}

/** Opens a print-ready tab; Select All → Copy → Paste into Google Docs keeps charts. */
export function openBillForGoogleDocs(draft: BillDraft): void {
  const html = buildBillHtmlForGoogleDocs(draft)
  const w = window.open('', '_blank')
  if (!w) {
    throw new Error('Popup blocked — allow popups, then try again.')
  }
  w.document.open()
  w.document.write(`<!DOCTYPE html><html><head>
    <title>${draft.billNumber} — FY${draft.fy}</title>
    <style>
      body { margin: 24px; background: #f4f1ea; }
      .hint {
        font-family: system-ui, sans-serif;
        font-size: 14px;
        background: #e8f2ec;
        border: 1px solid #b7d4c6;
        padding: 12px 14px;
        margin-bottom: 20px;
        max-width: 700px;
      }
      @media print { .hint { display: none; } }
    </style>
  </head><body>
    <div class="hint"><strong>For Google Docs:</strong> Select all (Ctrl/Cmd+A), copy (Ctrl/Cmd+C), then paste into a blank Google Doc. Charts and the table should come through formatted.</div>
    ${html.replace('<!DOCTYPE html><html><body>', '').replace('</body></html>', '')}
  </body></html>`)
  w.document.close()
}
