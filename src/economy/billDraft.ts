import { projectBudget } from './budgetEngine'
import type { JurisdictionState } from './types'
import { billMeta } from './billExport'

export interface BillDeptRow {
  id: string
  name: string
  type: string
  baseline: number
  allocated: number
}

export interface BillTaxLine {
  id: string
  name: string
  rateLabel: string
  yield: number
  dedicated: boolean
}

export interface BillBracketLine {
  label: string
  rate: number
}

export interface BillDraft {
  fingerprint: string
  fy: number
  congress: string
  session: string
  chamber: string
  billNumber: string
  shortTitle: string
  purpose: string
  enacting: string
  sponsor: string
  cosponsors: string
  gdp: number
  population: number
  unemploymentRate: number
  nationalDebt: number
  fiscalStance: string
  gdpGrowth: number
  departments: BillDeptRow[]
  incomeTaxMode: string
  incomeTaxYield: number
  flatRate: number
  brackets: BillBracketLine[]
  standardDeduction: number
  personalExemption: number
  optionalTaxes: BillTaxLine[]
  revenueIncomeTax: number
  revenueGeneral: number
  revenueDedicated: number
  revenueFederalGrant: number
  revenueTotal: number
  spendingTotal: number
  trustFunds: { id: string; name: string; balance: number }[]
  priorYearDisaster: number | null
  interestNote: string
}

/** Fingerprint of live budget numbers — used to detect stale drafts. */
export function budgetFingerprint(gov: JurisdictionState): string {
  const parts = [
    gov.period.fiscalYear,
    gov.economy.gdp,
    gov.economy.population,
    gov.economy.unemploymentRate,
    gov.economy.gdpGrowthRateAnnualized,
    gov.treasury.nationalDebt,
    gov.incomeTax.mode,
    gov.incomeTax.flatRate,
    ...gov.departments.map((d) => `${d.id}:${d.baseline}:${d.allocated}`),
    ...gov.optionalTaxes.map((t) => `${t.id}:${t.enacted}:${t.rate}`),
  ]
  return parts.join('|')
}

export function createBillDraft(
  gov: JurisdictionState,
  extras?: { sponsor?: string; cosponsors?: string; billNumber?: string },
): BillDraft {
  const proj = projectBudget(gov)
  const meta = billMeta(gov)
  const isFederal = gov.id === 'federal'

  return {
    fingerprint: budgetFingerprint(gov),
    fy: meta.fy,
    congress: meta.congress,
    session: meta.session,
    chamber: meta.chamber,
    billNumber: extras?.billNumber?.trim() || (isFederal ? 'H.R. 1' : 'H.R. 1'),
    shortTitle: meta.shortTitle,
    purpose: meta.purpose,
    enacting: meta.enacting,
    sponsor: extras?.sponsor?.trim() || 'Rep. _______________',
    cosponsors: extras?.cosponsors?.trim() || '',
    gdp: gov.economy.gdp,
    population: gov.economy.population,
    unemploymentRate: gov.economy.unemploymentRate,
    nationalDebt: gov.treasury.nationalDebt,
    fiscalStance: proj.fiscalStance,
    gdpGrowth: gov.economy.gdpGrowthRateAnnualized,
    departments: gov.departments.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      baseline: d.baseline,
      allocated: d.allocated,
    })),
    incomeTaxMode: gov.incomeTax.mode,
    incomeTaxYield: proj.revenue.incomeTax,
    flatRate: gov.incomeTax.flatRate,
    brackets: gov.incomeTax.brackets.map((b, i) => ({
      label:
        b.upTo == null
          ? `Bracket ${i + 1}: no upper limit`
          : `Bracket ${i + 1}: up to $${b.upTo.toLocaleString('en-US')}`,
      rate: b.rate,
    })),
    standardDeduction: gov.incomeTax.standardDeduction,
    personalExemption: gov.incomeTax.personalExemption,
    optionalTaxes: gov.optionalTaxes
      .filter((t) => t.enacted)
      .map((t) => {
        const y = proj.revenue.optional.find((o) => o.id === t.id)?.amount ?? 0
        const rateLabel =
          t.base === 'perUnit' ? `$${t.rate}` : `${(t.rate * 100).toFixed(1)}%`
        return {
          id: t.id,
          name: t.name,
          rateLabel,
          yield: y,
          dedicated: t.dedicated,
        }
      }),
    revenueIncomeTax: proj.revenue.incomeTax,
    revenueGeneral: proj.revenue.general,
    revenueDedicated: proj.revenue.dedicated,
    revenueFederalGrant: proj.revenue.federalGrant,
    revenueTotal: proj.revenue.total,
    spendingTotal: proj.spending.total,
    trustFunds: proj.spending.trustFundBalances.map((t) => ({
      id: t.id,
      name: t.name,
      balance: t.balance,
    })),
    priorYearDisaster: isFederal ? gov.priorYearDisasterAppropriation : null,
    interestNote: `Includes net interest and trust-fund outlays in total spending (${proj.spending.total}).`,
  }
}

export function draftBalance(draft: BillDraft): number {
  return draft.revenueTotal - draft.spendingTotal
}

export function draftDebtToGdp(draft: BillDraft): number {
  return draft.gdp > 0 ? draft.nationalDebt / draft.gdp : 0
}

export function draftDeptOutlays(draft: BillDraft): {
  baseline: number
  allocated: number
} {
  return {
    baseline: draft.departments.reduce((s, d) => s + d.baseline, 0),
    allocated: draft.departments.reduce((s, d) => s + d.allocated, 0),
  }
}

export function draftRevenueChartData(draft: BillDraft) {
  return [
    { name: 'Income tax', value: draft.revenueIncomeTax, color: '#0f3d32' },
    {
      name: 'Other general',
      value: Math.max(
        0,
        draft.revenueGeneral - draft.revenueIncomeTax - draft.revenueFederalGrant,
      ),
      color: '#1f6f5b',
    },
    { name: 'Dedicated', value: draft.revenueDedicated, color: '#2a5a8c' },
    ...(draft.revenueFederalGrant > 0
      ? [
          {
            name: 'Federal grants',
            value: draft.revenueFederalGrant,
            color: '#5c4a32',
          },
        ]
      : []),
  ].filter((d) => d.value > 0)
}

export function draftSpendingChartData(draft: BillDraft) {
  return draft.departments.map((d) => ({
    name: d.name,
    short: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name,
    baseline: d.baseline,
    allocated: d.allocated,
  }))
}

/** Plain text of the current draft (for clipboard). */
export function formatDraftText(draft: BillDraft): string {
  const bal = draftBalance(draft)
  const outlays = draftDeptOutlays(draft)
  return [
    draft.congress,
    draft.session,
    '',
    draft.billNumber,
    '',
    draft.shortTitle.toUpperCase(),
    '',
    draft.chamber,
    String(draft.fy),
    '',
    `Sponsor: ${draft.sponsor}`,
    `Co-Sponsors: ${draft.cosponsors || '________________'}`,
    '',
    '—'.repeat(40),
    draft.purpose,
    '—'.repeat(40),
    '',
    'A BILL',
    '',
    draft.purpose,
    '',
    draft.enacting,
    '',
    `SECTION 1. SHORT TITLE.`,
    `    This Act may be cited as the "${draft.shortTitle}".`,
    '',
    `SEC. 4. BUDGET TRACKING FY${draft.fy}`,
    ...draft.departments.map(
      (d) =>
        `  ${d.name}: baseline ${d.baseline} → allocation ${d.allocated}`,
    ),
    `  Total outlays: ${outlays.allocated}`,
    `  ${bal >= 0 ? 'Surplus' : 'Deficit'}: ${Math.abs(bal)}`,
    `  Debt: ${draft.nationalDebt}`,
    '',
    `Revenue total: ${draft.revenueTotal} · Spending total: ${draft.spendingTotal}`,
  ].join('\n')
}
