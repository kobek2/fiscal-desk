import type { EconomyState, LedgerEntry } from './types'
import { formatMoney } from './format'

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

/** Suggested draw as a share of the current Disaster Relief Trust Fund. */
export const RESERVE_SEVERITY_SHARE = {
  minor: { label: 'Minor', share: 0.05 },
  moderate: { label: 'Moderate', share: 0.1 },
  major: { label: 'Major', share: 0.15 },
  severe: { label: 'Severe', share: 0.2 },
} as const

export type ReserveSeverity = keyof typeof RESERVE_SEVERITY_SHARE

export function getDisasterFundBalance(state: EconomyState): number {
  return (
    state.governments.federal.trustFunds.find((t) => t.id === 'tf_disaster')
      ?.balance ?? 0
  )
}

export function severityGuide(fundBalance: number) {
  return (Object.keys(RESERVE_SEVERITY_SHARE) as ReserveSeverity[]).map(
    (key) => {
      const { label, share } = RESERVE_SEVERITY_SHARE[key]
      return {
        key,
        label,
        share,
        amount: fundBalance * share,
      }
    },
  )
}

/**
 * Admin records a presidentially approved draw from the Disaster Relief Trust Fund.
 * Caps at available balance — use emergency congressional funding for anything more.
 */
export function drawDisasterRelief(
  state: EconomyState,
  amount: number,
  note = '',
): EconomyState {
  const next = clone(state)
  const federal = next.governments.federal
  const tf = federal.trustFunds.find((t) => t.id === 'tf_disaster')
  if (!tf || amount <= 0) return next

  const drawn = Math.min(tf.balance, amount)
  const shortfall = amount - drawn
  tf.balance -= drawn

  const disasterDept = federal.departments.find((d) => d.id === 'disaster')
  if (disasterDept) disasterDept.spent += drawn

  const noteBit = note.trim() ? ` — ${note.trim()}` : ''
  let detail = `President approved ${formatMoney(amount)}. Drew ${formatMoney(drawn)} from Disaster Relief Trust Fund. Balance now ${formatMoney(tf.balance)}.${noteBit}`
  if (shortfall > 0) {
    detail += ` Shortfall ${formatMoney(shortfall)} was not taken from the fund — use Emergency Congressional Funding if Congress covers the rest.`
  }

  pushLog(next, {
    kind: 'event',
    title: `Disaster relief draw${noteBit}`,
    detail,
    amounts: { federal: -drawn },
  })

  return next
}

/**
 * Emergency supplemental when the disaster fund is empty / insufficient.
 * Goes straight to national debt (borrowed spending).
 */
export function emergencyCongressionalFunding(
  state: EconomyState,
  amount: number,
  note = '',
): EconomyState {
  const next = clone(state)
  if (amount <= 0) return next

  const federal = next.governments.federal
  federal.treasury.nationalDebt += amount

  const disasterDept = federal.departments.find((d) => d.id === 'disaster')
  if (disasterDept) disasterDept.spent += amount

  const noteBit = note.trim() ? ` — ${note.trim()}` : ''
  pushLog(next, {
    kind: 'appropriation',
    title: `Emergency congressional disaster funding${noteBit}`,
    detail: `Congress approved ${formatMoney(amount)} in emergency disaster funding. Added to national debt (now ${formatMoney(federal.treasury.nationalDebt)}). Fund balance unchanged — this is borrowed money, not a trust-fund draw.`,
    amounts: { federal: -amount },
  })

  return next
}
