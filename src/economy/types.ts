/** Political Process–style budget sim types (federal + regions). */

export type RegionId = 'west' | 'central' | 'east'
export type GovId = 'federal' | RegionId

export type FiscalStance = 'Stimulating' | 'Contracting' | 'Neutral'
export type IncomeMode = 'flat' | 'progressive'
export type TaxBase =
  | 'gdp'
  | 'corporateProfit'
  | 'consumption'
  | 'wages'
  | 'perUnit'
  | 'agi'
export type DeptType = 'mandatory' | 'discretionary'

export interface Period {
  fiscalYear: number
  /** Kept for compatibility; annual cadence always uses 1. */
  quarter: number
}

export interface TaxBracket {
  /** Upper bound of taxable income; null = open-ended top bracket. */
  upTo: number | null
  rate: number
}

export interface IncomeTaxPolicy {
  mode: IncomeMode
  /** Used when mode === 'flat' */
  flatRate: number
  brackets: TaxBracket[]
  standardDeduction: number
  personalExemption: number
}

export interface OptionalTax {
  id: string
  name: string
  enacted: boolean
  rate: number
  base: TaxBase
  /** For perUnit bases: estimated units (gallons, vehicles, etc.). */
  unitCount?: number
  /**
   * Narrow market in dollars (e.g. legal cannabis sales).
   * When set, yield = marketSize × rate (instead of full consumption/GDP).
   */
  marketSize?: number
  dedicated: boolean
  linkedTrustFund: string | null
  /** Plain-English: what is taxed. */
  description: string
  /** Plain-English: where the money goes. */
  destination: string
}

export interface TrustFund {
  id: string
  name: string
  balance: number
  fundedBy: string
  spendsOn: string
}

export interface Department {
  id: string
  name: string
  type: DeptType
  /** Prior-period maintain-current-services reference. */
  baseline: number
  /** Player/admin allocation (annual). */
  allocated: number
  /** Amount spent this period so far (events can increase). */
  spent: number
  trustFundLinked: string | null
  /** Sidebar group label */
  category: string
  /** Plain-English: what this money pays for. */
  description: string
}

export interface EconomyIndicators {
  gdp: number
  /**
   * Realized (or pending) annual GDP growth rate.
   * Set from Discord membership joins at FY close — not an admin dial.
   */
  gdpGrowthRateAnnualized: number
  population: number
  unemploymentRate: number
  laborForceParticipation: number
  jobVacancyRate: number
}

/**
 * Discord server membership drives national GDP growth each fiscal year.
 * Admins record joins (or total members) on the Admin Dashboard.
 */
export interface MembershipTracker {
  /** Last closed-year server headcount (for delta math). */
  lastTotalMembers: number | null
  /** Latest total entered by admin (optional). */
  currentTotalMembers: number | null
  /**
   * Net joins credited to the current open FY.
   * null = admin has not recorded yet for this year.
   */
  joinsThisYear: number | null
  /** Joins needed for 0% GDP growth (default 3). */
  flatThreshold: number
  /** GDP rate added per join above threshold (e.g. 0.005 = +0.5pp). */
  growthPerJoinAbove: number
  /** GDP rate subtracted per join below threshold (e.g. 0.01 = −1pp). */
  shrinkPerJoinBelow: number
  maxGrowth: number
  maxShrink: number
}

export interface Treasury {
  balance: number
  nationalDebt: number
  netInterestRate: number
}

export interface JurisdictionState {
  id: GovId
  name: string
  period: Period
  economy: EconomyIndicators
  treasury: Treasury
  incomeTax: IncomeTaxPolicy
  optionalTaxes: OptionalTax[]
  trustFunds: TrustFund[]
  departments: Department[]
  /** Federal → region grants received (regions only). */
  federalGrant: number
  /** Share of national GDP this jurisdiction represents (regions). */
  gdpShareOfNation: number
  /**
   * Prior FY Disaster Relief department appropriation.
   * Federal disaster trust fund is sized from this each year.
   */
  priorYearDisasterAppropriation: number
}

export interface LedgerEntry {
  id: string
  at: string
  kind: 'period' | 'event' | 'tax' | 'appropriation' | 'note' | 'submit'
  title: string
  detail: string
  amounts?: Partial<Record<GovId, number>>
}

export interface EconomyState {
  period: Period
  governments: Record<GovId, JurisdictionState>
  membership: MembershipTracker
  log: LedgerEntry[]
}

export type EventType =
  | 'wildfire'
  | 'hurricane'
  | 'flood'
  | 'tornado'
  | 'recession'
  | 'boom'

export type Severity = 1 | 2 | 3 | 4

export interface IncomeBand {
  label: string
  /** Midpoint used as proxy income for marginal schedule. */
  midpoint: number
  shareOfFilers: number
  shareOfAgi: number
}

/** Disaster severity → cost as % of GDP (spec §5c). */
export const DISASTER_GDP_PCT: Record<Severity, { min: number; max: number }> = {
  1: { min: 0.001, max: 0.003 },
  2: { min: 0.003, max: 0.008 },
  3: { min: 0.01, max: 0.015 },
  4: { min: 0.02, max: 0.035 },
}
