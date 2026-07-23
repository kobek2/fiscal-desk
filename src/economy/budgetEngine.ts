import type {
  Department,
  FiscalStance,
  JurisdictionState,
  OptionalTax,
  TrustFund,
} from './types'
import {
  FEDERAL_AGI_DISTRIBUTION,
  FEDERAL_TAX_BASE,
  calcIncomeTaxRevenue,
} from './incomeTax'

export interface RevenueBreakdown {
  incomeTax: number
  optional: { id: string; name: string; amount: number; dedicated: boolean; trustFund: string | null }[]
  general: number
  dedicated: number
  total: number
  federalGrant: number
}

export interface SpendingBreakdown {
  mandatory: number
  discretionary: number
  netInterest: number
  total: number
  fromTrustFunds: number
  fromGeneral: number
  trustFundBalances: { id: string; name: string; balance: number }[]
}

export interface BudgetProjection {
  revenue: RevenueBreakdown
  spending: SpendingBreakdown
  deficit: number
  surplus: number
  balance: number
  debtToGdp: number
  yearEndDebtPath: number
  fiscalStance: FiscalStance
  debtFlag: 'green' | 'yellow' | 'red'
  deptStatus: {
    id: string
    name: string
    baseline: number
    allocated: number
    ratio: number
    status: 'Above baseline' | 'At baseline' | 'Below baseline'
  }[]
}

function optionalYield(tax: OptionalTax, gdp: number, wages: number): number {
  if (!tax.enacted || tax.rate <= 0) return 0
  // Narrow markets (alcohol, marijuana, etc.) — don't tax all consumption
  if (tax.marketSize != null && tax.marketSize > 0) {
    return tax.marketSize * tax.rate
  }
  switch (tax.base) {
    case 'corporateProfit':
      return gdp * FEDERAL_TAX_BASE.corporateProfitShareOfGdp * tax.rate
    case 'consumption':
      return gdp * FEDERAL_TAX_BASE.consumptionShareOfGdp * tax.rate
    case 'wages':
      return wages * tax.rate
    case 'perUnit':
      return (tax.unitCount ?? 0) * tax.rate
    case 'agi':
      return FEDERAL_TAX_BASE.totalAgi * tax.rate * (gdp / 29_000_000_000_000)
    case 'gdp':
    default:
      return gdp * tax.rate
  }
}

function scaledWages(gov: JurisdictionState): number {
  if (gov.id === 'federal') return FEDERAL_TAX_BASE.totalWages
  return FEDERAL_TAX_BASE.totalWages * gov.gdpShareOfNation
}

function scaledAgi(gov: JurisdictionState): number {
  if (gov.id === 'federal') return FEDERAL_TAX_BASE.totalAgi
  return FEDERAL_TAX_BASE.totalAgi * gov.gdpShareOfNation
}

function scaledReturns(gov: JurisdictionState): number {
  if (gov.id === 'federal') return FEDERAL_TAX_BASE.returnsFiled
  return FEDERAL_TAX_BASE.returnsFiled * gov.gdpShareOfNation
}

export function calcRevenue(gov: JurisdictionState): RevenueBreakdown {
  const gdp = gov.economy.gdp
  const wages = scaledWages(gov)
  const incomeTax = calcIncomeTaxRevenue(
    gov.incomeTax.mode,
    gov.incomeTax.brackets,
    gov.incomeTax.flatRate,
    FEDERAL_AGI_DISTRIBUTION,
    scaledAgi(gov),
    scaledReturns(gov),
    gov.incomeTax.standardDeduction,
    gov.incomeTax.personalExemption,
  )

  const optional = gov.optionalTaxes.map((t) => ({
    id: t.id,
    name: t.name,
    amount: optionalYield(t, gdp, wages),
    dedicated: t.dedicated,
    trustFund: t.linkedTrustFund,
  }))

  let general = incomeTax + gov.federalGrant
  let dedicated = 0
  for (const o of optional) {
    if (o.dedicated) dedicated += o.amount
    else general += o.amount
  }

  return {
    incomeTax,
    optional,
    general,
    dedicated,
    total: general + dedicated,
    federalGrant: gov.federalGrant,
  }
}

export function netInterest(gov: JurisdictionState): number {
  return gov.treasury.nationalDebt * gov.treasury.netInterestRate
}

/**
 * Apply trust-fund draw-down for linked departments (spec §5c).
 * Returns spending split + projected trust balances after draws.
 */
export function calcSpending(gov: JurisdictionState): SpendingBreakdown {
  const funds: TrustFund[] = gov.trustFunds.map((t) => ({ ...t }))
  const fundMap = Object.fromEntries(funds.map((t) => [t.id, t]))

  // Deposit dedicated revenue into trust funds first
  const rev = calcRevenue(gov)
  for (const o of rev.optional) {
    if (o.dedicated && o.trustFund && fundMap[o.trustFund]) {
      fundMap[o.trustFund].balance += o.amount
    }
  }

  let mandatory = 0
  let discretionary = 0
  let fromTrustFunds = 0
  let fromGeneral = 0

  for (const d of gov.departments) {
    const amount = d.allocated
    if (d.type === 'mandatory') mandatory += amount
    else discretionary += amount

    if (d.trustFundLinked && fundMap[d.trustFundLinked]) {
      const tf = fundMap[d.trustFundLinked]
      if (tf.balance >= amount) {
        tf.balance -= amount
        fromTrustFunds += amount
      } else {
        const shortfall = amount - tf.balance
        fromTrustFunds += tf.balance
        fromGeneral += shortfall
        tf.balance = 0
      }
    } else {
      fromGeneral += amount
    }
  }

  const interest = netInterest(gov)
  fromGeneral += interest

  return {
    mandatory,
    discretionary,
    netInterest: interest,
    total: mandatory + discretionary + interest,
    fromTrustFunds,
    fromGeneral,
    trustFundBalances: funds.map((t) => ({
      id: t.id,
      name: t.name,
      balance: t.balance,
    })),
  }
}

export function fiscalStanceFrom(deficitPctGdp: number): FiscalStance {
  // Spec §6c — US ~5.8% deficit reads as Stimulating
  if (deficitPctGdp > 0.03) return 'Stimulating'
  if (deficitPctGdp < -0.01) return 'Contracting'
  return 'Neutral'
}

export function debtFlag(debtToGdp: number): 'green' | 'yellow' | 'red' {
  if (debtToGdp > 1.5) return 'red'
  if (debtToGdp >= 0.9) return 'yellow'
  return 'green'
}

export function deptStatuses(departments: Department[]) {
  return departments.map((d) => {
    const ratio = d.baseline > 0 ? d.allocated / d.baseline : 1
    const status =
      ratio > 1.02
        ? ('Above baseline' as const)
        : ratio < 0.98
          ? ('Below baseline' as const)
          : ('At baseline' as const)
    return {
      id: d.id,
      name: d.name,
      baseline: d.baseline,
      allocated: d.allocated,
      ratio,
      status,
    }
  })
}

export function projectBudget(gov: JurisdictionState): BudgetProjection {
  const revenue = calcRevenue(gov)
  const spending = calcSpending(gov)
  const balance = revenue.total - spending.total
  const deficit = balance < 0 ? -balance : 0
  const surplus = balance > 0 ? balance : 0
  const gdp = gov.economy.gdp
  const debtToGdp = gdp > 0 ? gov.treasury.nationalDebt / gdp : 0
  // Annual budget: path if this year's deficit repeats once more
  const yearEndDebtPath = gov.treasury.nationalDebt + deficit
  const deficitPctGdp = (spending.total - revenue.total) / gdp

  return {
    revenue,
    spending,
    deficit,
    surplus,
    balance,
    debtToGdp,
    yearEndDebtPath,
    fiscalStance: fiscalStanceFrom(deficitPctGdp),
    debtFlag: debtFlag(debtToGdp),
    deptStatus: deptStatuses(gov.departments),
  }
}

export function laborForce(gov: JurisdictionState): number {
  return gov.economy.population * gov.economy.laborForceParticipation
}

export function jobOpenings(gov: JurisdictionState): number {
  return laborForce(gov) * gov.economy.jobVacancyRate
}

export function unemployed(gov: JurisdictionState): number {
  return laborForce(gov) * gov.economy.unemploymentRate
}
