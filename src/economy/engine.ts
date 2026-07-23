import type {
  EconomyState,
  EventType,
  GovId,
  JurisdictionState,
  LedgerEntry,
  RegionId,
  Severity,
} from './types'
import { createFederal, createRegion } from './seed'
import { projectBudget } from './budgetEngine'
import { formatMoney, formatPct } from './format'
import { assessAdequacy, estimateRemediation } from './disaster'
import { DEFAULT_MEMBERSHIP, growthFromJoins } from './membership'

const ALL: GovId[] = ['federal', 'west', 'east', 'central']
const REGIONS: RegionId[] = ['west', 'east', 'central']

function clone<T>(x: T): T {
  return structuredClone(x)
}

function pushLog(
  state: EconomyState,
  entry: Omit<LedgerEntry, 'id' | 'at'>,
): void {
  state.log.unshift({
    ...entry,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  })
}

export function createInitialState(): EconomyState {
  const federal = createFederal()
  const gdp = federal.economy.gdp
  const pop = federal.economy.population
  return {
    period: { ...federal.period },
    governments: {
      federal,
      west: createRegion('west', gdp, pop),
      east: createRegion('east', gdp, pop),
      central: createRegion('central', gdp, pop),
    },
    membership: { ...DEFAULT_MEMBERSHIP },
    log: [
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind: 'note',
        title: 'Sim initialized (FY2028 baselines)',
        detail:
          'Annual federal budget cycle. GDP growth is driven by Discord server joins (Admin Dashboard). Record membership before submitting each FY.',
      },
    ],
  }
}

export function updateJurisdiction(
  state: EconomyState,
  govId: GovId,
  patch: (gov: JurisdictionState) => JurisdictionState,
): EconomyState {
  const next = clone(state)
  next.governments[govId] = patch(next.governments[govId])
  return next
}

/** Proportional cut across discretionary departments to close the gap. */
export function balanceBudget(
  state: EconomyState,
  govId: GovId,
): EconomyState {
  const next = clone(state)
  const gov = next.governments[govId]
  const proj = projectBudget(gov)
  if (proj.balance >= 0) {
    pushLog(next, {
      kind: 'note',
      title: `${gov.name}: already balanced or in surplus`,
      detail: `No discretionary cuts needed (balance ${formatMoney(proj.balance)}).`,
    })
    return next
  }

  const gap = proj.deficit
  const disc = gov.departments.filter((d) => d.type === 'discretionary')
  const discTotal = disc.reduce((s, d) => s + d.allocated, 0)
  if (discTotal <= 0) return next

  const cut = Math.min(gap, discTotal * 0.95)
  for (const d of disc) {
    const share = d.allocated / discTotal
    d.allocated = Math.max(0, d.allocated - cut * share)
  }

  pushLog(next, {
    kind: 'appropriation',
    title: `Balance Budget — ${gov.name}`,
    detail: `Cut ${formatMoney(cut)} proportionally across discretionary departments to close the gap.`,
    amounts: { [govId]: -cut },
  })
  return next
}

/**
 * Record Discord joins for the open fiscal year (Admin Dashboard).
 * Pass either joins directly, or a new total member count (delta from last total).
 */
export function recordMembership(
  state: EconomyState,
  input:
    | { mode: 'joins'; joins: number }
    | { mode: 'total'; totalMembers: number },
): EconomyState {
  const next = clone(state)
  const m = next.membership

  if (input.mode === 'joins') {
    const joins = Math.max(0, Math.floor(input.joins))
    m.joinsThisYear = joins
    if (m.lastTotalMembers != null) {
      m.currentTotalMembers = m.lastTotalMembers + joins
    }
  } else {
    const total = Math.max(0, Math.floor(input.totalMembers))
    m.currentTotalMembers = total
    if (m.lastTotalMembers != null) {
      m.joinsThisYear = Math.max(0, total - m.lastTotalMembers)
    } else {
      // Establish baseline headcount only — growth needs a later total or direct joins.
      m.lastTotalMembers = total
      m.joinsThisYear = null
      pushLog(next, {
        kind: 'note',
        title: `Server headcount baseline set (${total.toLocaleString('en-US')})`,
        detail:
          'Baseline saved. Enter joins for this FY, or a new total later so the site can compute the delta.',
      })
      return next
    }
  }

  const outlook = growthFromJoins(m.joinsThisYear ?? 0, m)
  pushLog(next, {
    kind: 'note',
    title: `Membership recorded for FY${next.period.fiscalYear}`,
    detail: outlook.summary,
  })
  return next
}

/**
 * President submits annual budget to Congress / close fiscal year.
 * National GDP growth comes from Discord joins recorded on the Admin Dashboard.
 */
export function submitBudget(state: EconomyState): EconomyState {
  const joins = state.membership.joinsThisYear
  if (joins == null) {
    throw new Error(
      'Record Discord membership (joins or total members) on the Admin Dashboard before submitting the budget.',
    )
  }

  const next = clone(state)
  const { fiscalYear } = next.period
  const lines: string[] = []

  const outlook = growthFromJoins(joins, next.membership)
  const growth = outlook.rate

  for (const id of ALL) {
    const gov = next.governments[id]
    const before = projectBudget(gov)
    const yearBalance = before.balance

    for (const tax of gov.optionalTaxes) {
      if (!tax.enacted || !tax.dedicated || !tax.linkedTrustFund) continue
      const taxYield =
        before.revenue.optional.find((o) => o.id === tax.id)?.amount ?? 0
      const tf = gov.trustFunds.find((t) => t.id === tax.linkedTrustFund)
      if (tf) tf.balance += taxYield
    }

    if (id === 'federal') {
      const disasterDept = gov.departments.find((d) => d.id === 'disaster')
      const tf = gov.trustFunds.find((t) => t.id === 'tf_disaster')
      if (disasterDept && tf) {
        gov.priorYearDisasterAppropriation = disasterDept.allocated
        tf.balance = disasterDept.allocated
        tf.fundedBy = `FY${fiscalYear} Disaster Relief appropriation`
      }
    }

    for (const d of gov.departments) {
      const spend = d.allocated
      d.spent += spend
      if (d.trustFundLinked && d.id !== 'disaster') {
        const tf = gov.trustFunds.find((t) => t.id === d.trustFundLinked)
        if (tf) {
          const fromTf = Math.min(tf.balance, spend)
          tf.balance -= fromTf
        }
      }
    }

    gov.treasury.nationalDebt = Math.max(
      0,
      gov.treasury.nationalDebt - yearBalance,
    )
    gov.treasury.balance += yearBalance

    // Store realized membership-driven growth on every jurisdiction
    gov.economy.gdpGrowthRateAnnualized = growth

    if (id !== 'federal') {
      const gdpBefore = gov.economy.gdp
      gov.economy.gdp *= 1 + growth

      // Labor market moves with the membership cycle
      gov.economy.unemploymentRate = clamp(
        gov.economy.unemploymentRate - growth * 0.4,
        0.025,
        0.18,
      )
      gov.economy.jobVacancyRate = clamp(
        gov.economy.jobVacancyRate + growth * 0.3,
        0.01,
        0.12,
      )
      gov.economy.laborForceParticipation = clamp(
        gov.economy.laborForceParticipation + growth * 0.08,
        0.55,
        0.72,
      )
      // Soft population drift with the cycle (not 1 Discord member = 1 citizen)
      gov.economy.population = Math.max(
        1,
        Math.round(gov.economy.population * (1 + growth * 0.12)),
      )

      lines.push(
        `${gov.name}: GDP ${formatMoney(gdpBefore)} → ${formatMoney(gov.economy.gdp)} (${formatPct(growth)}), uemp ${formatPct(gov.economy.unemploymentRate)}`,
      )
    } else {
      lines.push(
        `${gov.name}: budget ${formatMoney(yearBalance)} bal, debt ${formatMoney(gov.treasury.nationalDebt)}`,
      )
    }

    const growthMult = 1 + growth
    for (const d of gov.departments) {
      d.baseline = d.allocated * growthMult
      d.spent = 0
    }
  }

  const f = next.governments.federal
  f.economy.gdp =
    next.governments.west.economy.gdp +
    next.governments.central.economy.gdp +
    next.governments.east.economy.gdp
  f.economy.population =
    next.governments.west.economy.population +
    next.governments.central.economy.population +
    next.governments.east.economy.population
  f.economy.unemploymentRate =
    (next.governments.west.economy.unemploymentRate *
      next.governments.west.economy.population +
      next.governments.central.economy.unemploymentRate *
        next.governments.central.economy.population +
      next.governments.east.economy.unemploymentRate *
        next.governments.east.economy.population) /
    f.economy.population
  f.economy.jobVacancyRate =
    (next.governments.west.economy.jobVacancyRate *
      next.governments.west.economy.population +
      next.governments.central.economy.jobVacancyRate *
        next.governments.central.economy.population +
      next.governments.east.economy.jobVacancyRate *
        next.governments.east.economy.population) /
    f.economy.population
  f.economy.laborForceParticipation =
    (next.governments.west.economy.laborForceParticipation *
      next.governments.west.economy.population +
      next.governments.central.economy.laborForceParticipation *
        next.governments.central.economy.population +
      next.governments.east.economy.laborForceParticipation *
        next.governments.east.economy.population) /
    f.economy.population
  f.economy.gdpGrowthRateAnnualized = growth

  // Roll membership into next FY
  if (next.membership.currentTotalMembers != null) {
    next.membership.lastTotalMembers = next.membership.currentTotalMembers
  } else if (
    next.membership.lastTotalMembers != null &&
    next.membership.joinsThisYear != null
  ) {
    next.membership.lastTotalMembers += next.membership.joinsThisYear
    next.membership.currentTotalMembers = next.membership.lastTotalMembers
  }
  next.membership.joinsThisYear = null

  const y = fiscalYear + 1
  next.period = { fiscalYear: y, quarter: 1 }
  for (const id of ALL) {
    next.governments[id].period = { ...next.period }
  }

  pushLog(next, {
    kind: 'submit',
    title: `FY${fiscalYear} closed — ${outlook.phase} (${formatPct(growth)})`,
    detail: [
      outlook.summary,
      `Discord joins this year: ${outlook.joins}`,
      lines.join(' · '),
    ].join('\n'),
  })

  return next
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export interface PresidentialReliefOpts {
  type: EventType
  severity: Severity
  regionId: RegionId
  reliefAmount: number
}

/**
 * President-only disaster response: Disaster Relief Trust Fund first, then debt.
 */
export function presidentialRelief(
  state: EconomyState,
  opts: PresidentialReliefOpts,
): EconomyState {
  const next = clone(state)
  const estimate = estimateRemediation(
    state,
    opts.type,
    opts.severity,
    opts.regionId,
  )
  const federal = next.governments.federal
  const region = next.governments[opts.regionId]
  const amount = Math.max(0, opts.reliefAmount)
  const adequacy = assessAdequacy(amount, estimate)

  if (opts.type === 'recession' || opts.type === 'boom') {
    const pct = estimate.pctOfRegionalGdp
    const applied = opts.type === 'recession' ? -pct : pct
    region.economy.gdp *= 1 + applied
    federal.economy.gdp = REGIONS.reduce(
      (s, id) => s + next.governments[id].economy.gdp,
      0,
    )
    pushLog(next, {
      kind: 'event',
      title: `${estimate.label} (${estimate.severityLabel}) — ${region.name}`,
      detail: `Macro shock ${formatPct(applied)} to regional GDP. (No relief fund draw.)`,
    })
    return next
  }

  const tf = federal.trustFunds.find((t) => t.id === 'tf_disaster')
  let fromFund = 0
  let fromDebt = 0
  if (tf) {
    fromFund = Math.min(tf.balance, amount)
    tf.balance -= fromFund
  }
  fromDebt = amount - fromFund
  federal.treasury.nationalDebt += fromDebt

  const disasterDept = federal.departments.find((d) => d.id === 'disaster')
  if (disasterDept) disasterDept.spent += amount

  const discord = [
    estimate.discordBrief,
    '',
    `**Presidential relief committed: ${formatMoney(amount)}** — ${adequacy.label}`,
    adequacy.detail,
    `From Disaster Fund: ${formatMoney(fromFund)} · Added to national debt: ${formatMoney(fromDebt)}`,
    `Fund remaining: ${formatMoney(tf?.balance ?? 0)}`,
  ].join('\n')

  pushLog(next, {
    kind: 'event',
    title: `Presidential relief — ${estimate.label} ${estimate.severityLabel} (${region.name})`,
    detail: discord,
    amounts: { federal: -amount },
  })

  return next
}

/** Back-compat wrapper */
export function fundEvent(
  state: EconomyState,
  opts: {
    type: EventType
    severity: Severity
    regionId: RegionId
    totalCost?: number
    federalShare?: number
  },
): EconomyState {
  const estimate = estimateRemediation(
    state,
    opts.type,
    opts.severity,
    opts.regionId,
  )
  return presidentialRelief(state, {
    type: opts.type,
    severity: opts.severity,
    regionId: opts.regionId,
    reliefAmount: opts.totalCost ?? estimate.neededRecommended,
  })
}

export function previewEventCost(
  state: EconomyState,
  severity: Severity,
  regionId: RegionId,
  type: EventType = 'wildfire',
) {
  const e = estimateRemediation(state, type, severity, regionId)
  return {
    costMin: e.neededMin,
    costMax: e.neededMax,
    costMid: e.neededRecommended,
    pctOfGdpMin: e.neededMin / state.governments[regionId].economy.gdp,
    pctOfGdpMax: e.neededMax / state.governments[regionId].economy.gdp,
    estimate: e,
  }
}

export { estimateRemediation, assessAdequacy } from './disaster'
