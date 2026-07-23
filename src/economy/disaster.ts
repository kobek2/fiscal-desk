import type {
  EconomyState,
  EventType,
  RegionId,
  Severity,
} from './types'
import { formatMoney, formatPct } from './format'

/**
 * Cost to *remedy* a disaster as % of the affected region's GDP.
 * Tuned so Major Western wildfire ≈ tens of billions, not pocket change,
 * and Catastrophic can hit low hundreds of billions — meaningful vs a ~$95B fund.
 */
export const REMEDIATION_GDP_PCT: Record<
  EventType,
  Record<Severity, { min: number; recommended: number; max: number }>
> = {
  wildfire: {
    1: { min: 0.0008, recommended: 0.0015, max: 0.0025 },
    2: { min: 0.0025, recommended: 0.005, max: 0.008 },
    3: { min: 0.008, recommended: 0.012, max: 0.02 },
    4: { min: 0.02, recommended: 0.03, max: 0.045 },
  },
  hurricane: {
    1: { min: 0.001, recommended: 0.002, max: 0.0035 },
    2: { min: 0.004, recommended: 0.008, max: 0.012 },
    3: { min: 0.012, recommended: 0.02, max: 0.03 },
    4: { min: 0.03, recommended: 0.045, max: 0.07 },
  },
  flood: {
    1: { min: 0.0006, recommended: 0.0012, max: 0.002 },
    2: { min: 0.002, recommended: 0.004, max: 0.007 },
    3: { min: 0.007, recommended: 0.012, max: 0.018 },
    4: { min: 0.018, recommended: 0.028, max: 0.04 },
  },
  tornado: {
    1: { min: 0.0004, recommended: 0.0008, max: 0.0015 },
    2: { min: 0.0015, recommended: 0.003, max: 0.005 },
    3: { min: 0.005, recommended: 0.009, max: 0.014 },
    4: { min: 0.014, recommended: 0.022, max: 0.035 },
  },
  recession: {
    1: { min: 0.002, recommended: 0.003, max: 0.004 },
    2: { min: 0.005, recommended: 0.008, max: 0.01 },
    3: { min: 0.012, recommended: 0.018, max: 0.025 },
    4: { min: 0.03, recommended: 0.045, max: 0.06 },
  },
  boom: {
    1: { min: 0.002, recommended: 0.003, max: 0.004 },
    2: { min: 0.005, recommended: 0.008, max: 0.01 },
    3: { min: 0.012, recommended: 0.016, max: 0.02 },
    4: { min: 0.02, recommended: 0.028, max: 0.035 },
  },
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  1: 'Minor',
  2: 'Moderate',
  3: 'Major',
  4: 'Catastrophic',
}

export const EVENT_LABELS: Record<EventType, string> = {
  wildfire: 'Wildfire',
  hurricane: 'Hurricane / Tropical Storm',
  flood: 'Major Flooding',
  tornado: 'Tornado Outbreak',
  recession: 'Economic Downturn',
  boom: 'Economic Boom',
}

export type Adequacy =
  | 'full'
  | 'adequate'
  | 'partial'
  | 'inadequate'

export interface RemediationEstimate {
  type: EventType
  severity: Severity
  regionId: RegionId
  label: string
  severityLabel: string
  /** Minimum to avoid "inadequate" — temporary shelters, basic aid. */
  neededMin: number
  /** Amount that fully remedies the event for RP purposes. */
  neededRecommended: number
  /** Upper bound — gold-plated / multi-year rebuild. */
  neededMax: number
  pctOfRegionalGdp: number
  pctOfNationalGdp: number
  disasterFundBalance: number
  defenseBudget: number
  /** Soft guidance: fund balance. Going over creates debt — not blocked. */
  softCapFromFund: number
  comparisons: string[]
  discordBrief: string
}

export function estimateRemediation(
  state: EconomyState,
  type: EventType,
  severity: Severity,
  regionId: RegionId,
): RemediationEstimate {
  const region = state.governments[regionId]
  const federal = state.governments.federal
  const band = REMEDIATION_GDP_PCT[type][severity]
  const gdp = region.economy.gdp
  const neededMin = gdp * band.min
  const neededRecommended = gdp * band.recommended
  const neededMax = gdp * band.max

  const fund =
    federal.trustFunds.find((t) => t.id === 'tf_disaster')?.balance ?? 0
  const defense =
    federal.departments.find((d) => d.id === 'defense')?.allocated ?? 0

  const comparisons = [
    `${formatPct(band.recommended)} of ${region.name} GDP`,
    `${formatPct(neededRecommended / federal.economy.gdp)} of national GDP`,
    defense > 0
      ? `${formatPct(neededRecommended / defense)} of annual Defense budget`
      : '',
    fund > 0
      ? `${formatPct(neededRecommended / fund)} of Disaster Relief Trust Fund`
      : 'Disaster fund empty — any relief adds to national debt',
  ].filter(Boolean)

  const discordBrief = [
    `**${EVENT_LABELS[type]} — ${SEVERITY_LABELS[severity]} (${region.name})**`,
    `To remedy: **${formatMoney(neededRecommended)}** (range ${formatMoney(neededMin)}–${formatMoney(neededMax)})`,
    ...comparisons.map((c) => `• ${c}`),
    `Disaster fund on hand: ${formatMoney(fund)}`,
    `_President sets the relief amount. Underfunding = incomplete response; over the fund = more debt._`,
  ].join('\n')

  return {
    type,
    severity,
    regionId,
    label: EVENT_LABELS[type],
    severityLabel: SEVERITY_LABELS[severity],
    neededMin,
    neededRecommended,
    neededMax,
    pctOfRegionalGdp: band.recommended,
    pctOfNationalGdp: neededRecommended / federal.economy.gdp,
    disasterFundBalance: fund,
    defenseBudget: defense,
    softCapFromFund: fund,
    comparisons,
    discordBrief,
  }
}

export function assessAdequacy(
  amount: number,
  estimate: RemediationEstimate,
): { level: Adequacy; label: string; detail: string } {
  if (amount >= estimate.neededRecommended * 0.95) {
    return {
      level: 'full',
      label: 'Fully remedies',
      detail:
        'Relief meets the recommended package — RP can treat the crisis as addressed.',
    }
  }
  if (amount >= estimate.neededMin) {
    return {
      level: 'partial',
      label: 'Partial response',
      detail:
        'Helps, but short of a full remedy — expect ongoing damage / political pressure.',
    }
  }
  if (amount > 0) {
    return {
      level: 'inadequate',
      label: 'Inadequate',
      detail:
        'Far below what’s needed — homes/uninsured losses largely unaddressed in RP terms.',
    }
  }
  return {
    level: 'inadequate',
    label: 'No relief',
    detail: 'No federal funds committed.',
  }
}
