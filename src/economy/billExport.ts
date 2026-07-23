import type { BudgetProjection } from './budgetEngine'
import type { JurisdictionState } from './types'
import { formatMoney, formatPct } from './format'

export function billMeta(gov: JurisdictionState) {
  const fy = gov.period.fiscalYear
  const isFederal = gov.id === 'federal'
  return {
    fy,
    isFederal,
    congress: '119th CONGRESS',
    session: '2d Session',
    billNo: 'H.R. ____',
    chamber: isFederal
      ? 'IN THE UNITED STATES HOUSE OF REPRESENTATIVES'
      : `IN THE HOUSE OF REPRESENTATIVES — ${gov.name.toUpperCase()}`,
    shortTitle: isFederal
      ? `Fiscal Year ${fy} Federal Budget and Appropriations Act`
      : `Fiscal Year ${fy} ${gov.name} Budget Act`,
    purpose: isFederal
      ? `To authorize revenues and appropriations for Fiscal Year ${fy} for the Federal Government, to set forth tax policy and departmental funding levels, and for other purposes.`
      : `To authorize revenues and appropriations for Fiscal Year ${fy} for the ${gov.name}, and for other purposes.`,
    enacting: isFederal
      ? 'Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled,'
      : `Be it enacted by the House of Representatives for the ${gov.name} assembled,`,
  }
}

export function spendingChartData(gov: JurisdictionState) {
  return gov.departments.map((d) => ({
    name: d.name,
    short:
      d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name,
    baseline: d.baseline,
    allocated: d.allocated,
  }))
}

export function revenueChartData(proj: BudgetProjection) {
  return [
    { name: 'Income tax', value: proj.revenue.incomeTax, color: '#0f3d32' },
    {
      name: 'Other general',
      value: Math.max(
        0,
        proj.revenue.general - proj.revenue.incomeTax - proj.revenue.federalGrant,
      ),
      color: '#1f6f5b',
    },
    { name: 'Dedicated', value: proj.revenue.dedicated, color: '#2a5a8c' },
    ...(proj.revenue.federalGrant > 0
      ? [{ name: 'Federal grants', value: proj.revenue.federalGrant, color: '#5c4a32' }]
      : []),
  ].filter((d) => d.value > 0)
}

/** Plain-text fallback for Discord / paste when charts can't travel. */
export function formatBudgetBill(
  state: { governments: Record<string, JurisdictionState>; period: { fiscalYear: number } },
  govId: string,
  extras?: { sponsor?: string; cosponsors?: string; billNumber?: string },
): string {
  const gov = state.governments[govId]
  // dynamic import avoided — caller should use projectBudget; we accept precomputed via optional
  // Keep a readable text twin of the visual bill
  const meta = billMeta(gov)
  const sponsor = extras?.sponsor?.trim() || '________________'
  const cosponsors = extras?.cosponsors?.trim() || '________________'
  const billNo = extras?.billNumber?.trim() || meta.billNo

  return [
    meta.congress,
    meta.session,
    '',
    billNo,
    '',
    meta.shortTitle.toUpperCase(),
    '',
    meta.chamber,
    String(meta.fy),
    '',
    `Sponsor: ${sponsor}`,
    `Co-Sponsors: ${cosponsors}`,
    '',
    '—'.repeat(40),
    meta.purpose,
    '—'.repeat(40),
    '',
    'A BILL',
    '',
    meta.purpose,
    '',
    meta.enacting,
    '',
    `SECTION 1. SHORT TITLE.`,
    `    This Act may be cited as the "${meta.shortTitle}".`,
    '',
    '(Full schedules, charts, and departmental tables appear in the official bill packet preview. Use Print / Save as PDF from Fiscal Desk for the complete visual submission.)',
    '',
    `GDP ${formatMoney(gov.economy.gdp)} · Debt ${formatMoney(gov.treasury.nationalDebt)} · Debt/GDP ${formatPct(gov.treasury.nationalDebt / gov.economy.gdp)}`,
  ].join('\n')
}
