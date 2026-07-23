import type { IncomeBand, TaxBracket } from './types'

/** Simplified IRS-style AGI distribution (spec §4a). */
export const FEDERAL_AGI_DISTRIBUTION: IncomeBand[] = [
  { label: '$0–$10K', midpoint: 5_000, shareOfFilers: 0.15, shareOfAgi: 0.01 },
  { label: '$10K–$50K', midpoint: 30_000, shareOfFilers: 0.35, shareOfAgi: 0.12 },
  { label: '$50K–$100K', midpoint: 75_000, shareOfFilers: 0.25, shareOfAgi: 0.2 },
  { label: '$100K–$200K', midpoint: 150_000, shareOfFilers: 0.15, shareOfAgi: 0.24 },
  { label: '$200K–$400K', midpoint: 300_000, shareOfFilers: 0.06, shareOfAgi: 0.15 },
  { label: '$400K+', midpoint: 750_000, shareOfFilers: 0.04, shareOfAgi: 0.28 },
]

/** Federal taxable-income / AGI anchors (FY2025-ish). */
export const FEDERAL_TAX_BASE = {
  totalAgi: 15_200_000_000_000,
  taxableIncome: 11_700_000_000_000,
  returnsFiled: 153_000_000,
  /** Wage base for payroll (SS portion roughly). */
  totalWages: 12_000_000_000_000,
  corporateProfitShareOfGdp: 0.095,
  consumptionShareOfGdp: 0.68,
}

/** Approx. 2025 IRS single-filer schedule, rounded to clean thousands. */
export const DEFAULT_FEDERAL_BRACKETS: TaxBracket[] = [
  { upTo: 12_000, rate: 0.1 },
  { upTo: 49_000, rate: 0.12 },
  { upTo: 100_000, rate: 0.22 },
  { upTo: 200_000, rate: 0.24 },
  { upTo: 250_000, rate: 0.32 },
  { upTo: 625_000, rate: 0.35 },
  { upTo: null, rate: 0.37 },
]

/** Typical state progressive schedule, rounded thousands. */
export const DEFAULT_STATE_BRACKETS: TaxBracket[] = [
  { upTo: 10_000, rate: 0.02 },
  { upTo: 40_000, rate: 0.04 },
  { upTo: 80_000, rate: 0.055 },
  { upTo: 160_000, rate: 0.07 },
  { upTo: null, rate: 0.09 },
]

/**
 * Apply progressive (or flat) schedule to a single proxy income.
 * Flat mode: ignore brackets, use flatRate on full income.
 */
export function marginalTaxOnIncome(
  income: number,
  brackets: TaxBracket[],
  mode: 'flat' | 'progressive',
  flatRate: number,
): number {
  if (income <= 0) return 0
  if (mode === 'flat') return income * flatRate

  const sorted = [...brackets].sort((a, b) => {
    if (a.upTo === null) return 1
    if (b.upTo === null) return -1
    return a.upTo - b.upTo
  })

  let tax = 0
  let prev = 0
  for (const b of sorted) {
    const ceiling = b.upTo ?? Infinity
    const slice = Math.max(0, Math.min(income, ceiling) - prev)
    tax += slice * b.rate
    prev = ceiling
    if (income <= ceiling) break
  }
  return tax
}

export function effectiveRateAt(
  income: number,
  brackets: TaxBracket[],
  mode: 'flat' | 'progressive',
  flatRate: number,
): number {
  if (income <= 0) return 0
  return marginalTaxOnIncome(income, brackets, mode, flatRate) / income
}

/**
 * Spec §4a: band AGI × effective rate at band midpoint.
 * Deduction/exemption haircut applied as a share of AGI (game-scale).
 */
export function calcIncomeTaxRevenue(
  mode: 'flat' | 'progressive',
  brackets: TaxBracket[],
  flatRate: number,
  distribution: IncomeBand[],
  totalAgi: number,
  returnsFiled: number,
  standardDeduction: number,
  personalExemption: number,
): number {
  let revenue = 0
  for (const band of distribution) {
    const bandIncome = totalAgi * band.shareOfAgi
    const rate = effectiveRateAt(band.midpoint, brackets, mode, flatRate)
    revenue += bandIncome * rate
  }
  // Approximate deduction/exemption cost (not full microsimulation)
  const deductionHaircut =
    returnsFiled * (standardDeduction * 0.15 + personalExemption * 0.08)
  return Math.max(0, revenue - deductionHaircut)
}
