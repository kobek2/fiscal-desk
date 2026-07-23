/** Format large USD amounts for Discord-friendly display. */
export function formatMoney(n: number, compact = true): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)

  if (!compact) {
    return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }

  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function formatPct(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits)}%`
}

export function formatPeople(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString('en-US')
}
