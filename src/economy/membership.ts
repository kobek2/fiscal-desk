import { formatPct } from './format'
import type { MembershipTracker } from './types'

/** Default Discord membership → GDP rules. */
export const DEFAULT_MEMBERSHIP: MembershipTracker = {
  lastTotalMembers: null,
  currentTotalMembers: null,
  joinsThisYear: null,
  flatThreshold: 3,
  /** +0.5pp GDP per member above the flat threshold */
  growthPerJoinAbove: 0.005,
  /** −1.0pp GDP per member below the flat threshold */
  shrinkPerJoinBelow: 0.01,
  maxGrowth: 0.06,
  maxShrink: 0.05,
}

export interface GrowthFromJoins {
  joins: number
  rate: number
  phase: 'expansion' | 'stable'
  summary: string
}

/**
 * GDP growth from Discord joins for the fiscal year.
 * Below / at threshold → 0% (never negative). Above → grow.
 */
export function growthFromJoins(
  joins: number,
  rules: Pick<
    MembershipTracker,
    | 'flatThreshold'
    | 'growthPerJoinAbove'
    | 'shrinkPerJoinBelow'
    | 'maxGrowth'
    | 'maxShrink'
  > = DEFAULT_MEMBERSHIP,
): GrowthFromJoins {
  const n = Math.max(0, Math.floor(joins))
  const t = Math.max(0, Math.floor(rules.flatThreshold))

  let rate = 0
  let phase: GrowthFromJoins['phase'] = 'stable'

  if (n > t) {
    rate = Math.min(rules.maxGrowth, (n - t) * rules.growthPerJoinAbove)
    phase = 'expansion'
  }

  const summary =
    n > t
      ? `${n} joins (${n - t} above threshold ${t}) → ${formatPct(rate)} growth`
      : `${n} joins (at or below threshold ${t}) → flat ${formatPct(rate)}`

  return { joins: n, rate, phase, summary }
}

/** Joins implied by a new total vs last recorded total. */
export function joinsFromTotals(
  previousTotal: number | null,
  newTotal: number,
): number | null {
  if (previousTotal == null || !Number.isFinite(previousTotal)) return null
  return Math.max(0, Math.floor(newTotal) - Math.floor(previousTotal))
}
