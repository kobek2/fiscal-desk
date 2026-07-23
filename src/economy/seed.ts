import type {
  Department,
  JurisdictionState,
  OptionalTax,
  TrustFund,
} from './types'
import {
  DEFAULT_FEDERAL_BRACKETS,
  DEFAULT_STATE_BRACKETS,
} from './incomeTax'

function fedOptionalTaxes(): OptionalTax[] {
  return [
    {
      id: 'payroll_ss',
      name: 'Payroll Tax (Social Security)',
      enacted: true,
      rate: 0.124,
      base: 'wages',
      dedicated: true,
      linkedTrustFund: 'tf_ss',
      description:
        'This is how Social Security is funded — not a tax on retirees’ benefit checks. Working people (and their employers) pay a share of each paycheck into the system. That money pays monthly benefits to retirees, disabled workers, and survivors. Real combined rate: 12.4% of wages.',
      destination:
        'Goes into the Social Security Trust Fund, then out as benefit payments (see the Social Security department on the spending side).',
    },
    {
      id: 'payroll_medicare',
      name: 'Payroll Tax (Medicare)',
      enacted: true,
      rate: 0.029,
      base: 'wages',
      dedicated: true,
      linkedTrustFund: 'tf_medicare',
      description:
        'Same idea as Social Security: workers pay in from paychecks so seniors can get Medicare health coverage. Real rate: 2.9% of wages (simplified here).',
      destination:
        'Goes into the Medicare Trust Fund, then helps pay Medicare (see Medicare under spending).',
    },
    {
      id: 'corporate',
      name: 'Corporate Tax',
      enacted: true,
      rate: 0.21,
      base: 'corporateProfit',
      dedicated: false,
      linkedTrustFund: null,
      description:
        'Tax on company profits (about 9–10% of GDP is treated as the profit base). Real federal rate is 21%.',
      destination:
        'General budget — Congress can spend it on anything.',
    },
    {
      id: 'sales',
      name: 'Sales Tax',
      enacted: false,
      rate: 0.05,
      base: 'consumption',
      dedicated: false,
      linkedTrustFund: null,
      description:
        'Tax on goods and services people buy. The real U.S. federal government has no national sales tax (states do). Leave off for realism, or turn on for RP.',
      destination:
        'General budget — flexible spending.',
    },
    {
      id: 'gas',
      name: 'Gas / Fuel Tax',
      enacted: true,
      rate: 0.184,
      base: 'perUnit',
      unitCount: 140_000_000_000,
      dedicated: true,
      linkedTrustFund: 'tf_highway',
      description:
        'Cents per gallon of fuel (real federal rate is about $0.184/gallon). Yield ≈ gallons sold × rate.',
      destination:
        'Dedicated → Highway Trust Fund (roads, bridges, transit).',
    },
    {
      id: 'vehicle',
      name: 'Vehicle Registration',
      enacted: false,
      rate: 50,
      base: 'perUnit',
      unitCount: 280_000_000,
      dedicated: true,
      linkedTrustFund: 'tf_highway',
      description:
        'Flat fee per registered vehicle. Mostly a state/local tax in real life — off by default at the federal level.',
      destination:
        'Dedicated → Highway Trust Fund if enacted.',
    },
    {
      id: 'alcohol',
      name: 'Alcohol Tax',
      enacted: true,
      rate: 0.04,
      base: 'consumption',
      marketSize: 250_000_000_000,
      dedicated: false,
      linkedTrustFund: null,
      description:
        'Excise tax on alcohol sales. Applied to an ~$250B alcohol market (not all consumer spending). Real federal alcohol taxes raise roughly ~$10B/year at typical rates.',
      destination:
        'General budget.',
    },
    {
      id: 'marijuana',
      name: 'Marijuana Tax',
      enacted: false,
      rate: 0.15,
      base: 'consumption',
      marketSize: 32_000_000_000,
      dedicated: false,
      linkedTrustFund: null,
      description:
        'Tax on legal cannabis sales only (~$32B market). There is no real federal marijuana tax while it remains federally illegal — off by default.',
      destination:
        'General budget if your sim legalizes it.',
    },
    {
      id: 'carbon',
      name: 'Carbon Tax',
      enacted: false,
      rate: 0.005,
      base: 'gdp',
      dedicated: false,
      linkedTrustFund: null,
      description:
        'Tax tied to economy-wide emissions (simplified as a % of GDP). Not a current U.S. federal tax — off by default. Small rates only (0.5% of GDP ≈ $145B).',
      destination:
        'General budget (or earmark later via RP).',
    },
  ]
}

function fedTrustFunds(): TrustFund[] {
  return [
    {
      id: 'tf_ss',
      name: 'Social Security Trust Fund',
      balance: 2_700_000_000_000,
      fundedBy: 'Payroll Tax (SS)',
      spendsOn: 'Social Security',
    },
    {
      id: 'tf_medicare',
      name: 'Medicare Trust Fund',
      balance: 250_000_000_000,
      fundedBy: 'Payroll Tax (Medicare)',
      spendsOn: 'Medicare',
    },
    {
      id: 'tf_highway',
      name: 'Highway Trust Fund',
      balance: 40_000_000_000,
      fundedBy: 'Gas / Fuel Tax, Vehicle Registration',
      spendsOn: 'Transportation',
    },
    {
      id: 'tf_disaster',
      name: 'Disaster Relief Trust Fund',
      balance: 40_000_000_000,
      fundedBy: 'Prior-year Disaster Relief appropriation',
      spendsOn: 'Disaster Relief',
    },
  ]
}

function fedDepartments(): Department[] {
  const d = (
    partial: Omit<Department, 'spent'> & { spent?: number },
  ): Department => ({ spent: 0, ...partial })

  return [
    d({
      id: 'ss',
      name: 'Social Security',
      type: 'mandatory',
      category: 'Mandatory',
      baseline: 1_500_000_000_000,
      allocated: 1_500_000_000_000,
      trustFundLinked: 'tf_ss',
      description:
        'Monthly income for retirees, disabled workers, and survivors. Paid mainly from the Social Security Trust Fund (payroll taxes).',
    }),
    d({
      id: 'medicare',
      name: 'Medicare',
      type: 'mandatory',
      category: 'Mandatory',
      baseline: 997_000_000_000,
      allocated: 997_000_000_000,
      trustFundLinked: 'tf_medicare',
      description:
        'Health coverage for seniors and some disabled Americans. Funded largely by Medicare payroll taxes + premiums.',
    }),
    d({
      id: 'medicaid',
      name: 'Health (Medicaid & other)',
      type: 'mandatory',
      category: 'Mandatory',
      baseline: 979_000_000_000,
      allocated: 979_000_000_000,
      trustFundLinked: null,
      description:
        'Health coverage for low-income people, plus related federal health programs. Mostly general-fund mandatory spending.',
    }),
    d({
      id: 'income_security',
      name: 'Income Security',
      type: 'mandatory',
      category: 'Mandatory',
      baseline: 702_000_000_000,
      allocated: 702_000_000_000,
      trustFundLinked: null,
      description:
        'Safety-net cash and food aid: SNAP, unemployment support, EITC, housing assistance, and similar programs.',
    }),
    d({
      id: 'veterans',
      name: "Veterans' Benefits",
      type: 'mandatory',
      category: 'Mandatory',
      baseline: 377_000_000_000,
      allocated: 377_000_000_000,
      trustFundLinked: null,
      description:
        'Disability compensation, pensions, and VA health care for veterans and their families.',
    }),
    d({
      id: 'defense',
      name: 'National Defense',
      type: 'discretionary',
      category: 'Discretionary',
      baseline: 917_000_000_000,
      allocated: 917_000_000_000,
      trustFundLinked: null,
      description:
        'Military personnel, operations, weapons, and bases. Congress sets this each year in the defense bill.',
    }),
    d({
      id: 'transport',
      name: 'Transportation',
      type: 'discretionary',
      category: 'Discretionary',
      baseline: 146_000_000_000,
      allocated: 146_000_000_000,
      trustFundLinked: 'tf_highway',
      description:
        'Highways, bridges, transit, aviation, and rail. Gas-tax money in the Highway Trust Fund covers part of this first.',
    }),
    d({
      id: 'environment',
      name: 'Natural Resources / Environment',
      type: 'discretionary',
      category: 'Discretionary',
      baseline: 88_000_000_000,
      allocated: 88_000_000_000,
      trustFundLinked: null,
      description:
        'Parks, forests, EPA-style cleanup, water, and conservation programs.',
    }),
    d({
      id: 'education',
      name: 'Education / Training / Social Services',
      type: 'discretionary',
      category: 'Discretionary',
      baseline: 90_000_000_000,
      allocated: 90_000_000_000,
      trustFundLinked: null,
      description:
        'Federal education grants, job training, and social-service programs (states run most K–12 themselves).',
    }),
    d({
      id: 'agriculture',
      name: 'Agriculture',
      type: 'discretionary',
      category: 'Discretionary',
      baseline: 49_000_000_000,
      allocated: 49_000_000_000,
      trustFundLinked: null,
      description:
        'Farm supports, rural development, food safety, and related USDA programs.',
    }),
    d({
      id: 'intl',
      name: 'International Affairs',
      type: 'discretionary',
      category: 'Discretionary',
      baseline: 45_000_000_000,
      allocated: 45_000_000_000,
      trustFundLinked: null,
      description:
        'Diplomacy, embassies, foreign aid, and international organizations.',
    }),
    d({
      id: 'science',
      name: 'General Science / Space / Tech',
      type: 'discretionary',
      category: 'Discretionary',
      baseline: 42_000_000_000,
      allocated: 42_000_000_000,
      trustFundLinked: null,
      description:
        'NASA, basic research agencies, and federal science & technology programs.',
    }),
    d({
      id: 'disaster',
      name: 'Disaster Relief',
      type: 'discretionary',
      category: 'Discretionary',
      baseline: 40_000_000_000,
      allocated: 40_000_000_000,
      trustFundLinked: 'tf_disaster',
      description:
        'Annual appropriation that refills the Disaster Relief Trust Fund. The fund is only one part of resolving Discord events — admins draw from it when the President approves relief, and Congress can add emergency debt funding if it runs dry.',
    }),
  ]
}

export function createFederal(): JurisdictionState {
  return {
    id: 'federal',
    name: 'Federal Government',
    period: { fiscalYear: 2026, quarter: 1 },
    economy: {
      gdp: 29_000_000_000_000,
      gdpGrowthRateAnnualized: 0,
      population: 335_000_000,
      unemploymentRate: 0.041,
      laborForceParticipation: 0.625,
      jobVacancyRate: 0.045,
    },
    treasury: {
      balance: 500_000_000_000,
      nationalDebt: 38_700_000_000_000,
      netInterestRate: 0.032,
    },
    incomeTax: {
      mode: 'progressive',
      flatRate: 0.145,
      brackets: structuredClone(DEFAULT_FEDERAL_BRACKETS),
      standardDeduction: 15_000,
      personalExemption: 0,
    },
    optionalTaxes: fedOptionalTaxes(),
    trustFunds: fedTrustFunds(),
    departments: fedDepartments(),
    federalGrant: 0,
    gdpShareOfNation: 1,
    priorYearDisasterAppropriation: 40_000_000_000,
  }
}

/** Regional GDP/pop shares (West / East / Central) — weighted, not equal thirds. */
export const REGION_SHARES = {
  west: { gdp: 0.264, pop: 0.24, label: 'Western Region', states: 'WA, OR, ID, MT, WY, UT, CO, CA, NV, AZ, NM, AK, HI' },
  east: { gdp: 0.555, pop: 0.596, label: 'Eastern Region', states: 'Northeast, Great Lakes, Mid-Atlantic, Southeast & FL' },
  central: { gdp: 0.181, pop: 0.164, label: 'Central Region', states: 'ND, SD, MN, NE, KS, IA, MO, OK, TX, AR, LA' },
} as const

function regionOptionalTaxes(prefix: string, scale: number): OptionalTax[] {
  return [
    {
      id: `${prefix}_sales`,
      name: 'Sales Tax',
      enacted: true,
      rate: 0.055,
      base: 'consumption',
      dedicated: false,
      linkedTrustFund: null,
      description:
        'Tax on most retail purchases. Real average state sales tax is around 5–7%. Main flexible money for the region.',
      destination: 'General regional budget — can fund schools, cops, etc.',
    },
    {
      id: `${prefix}_corporate`,
      name: 'Corporate Tax',
      enacted: true,
      rate: 0.06,
      base: 'corporateProfit',
      dedicated: false,
      linkedTrustFund: null,
      description:
        'Tax on business profits earned in the region. Typical state corporate rates are in the mid single digits.',
      destination: 'General regional budget.',
    },
    {
      id: `${prefix}_gas`,
      name: 'Gas / Fuel Tax',
      enacted: true,
      rate: 0.3,
      base: 'perUnit',
      unitCount: 40_000_000_000 * (prefix === 'east' ? 1.5 : prefix === 'west' ? 1.1 : 0.8),
      dedicated: true,
      linkedTrustFund: `${prefix}_tf_roads`,
      description:
        'State cents-per-gallon on fuel (often ~$0.25–$0.50/gal on top of the federal gas tax).',
      destination: 'Dedicated → State Roads Trust Fund.',
    },
    {
      id: `${prefix}_alcohol`,
      name: 'Alcohol Tax',
      enacted: true,
      rate: 0.05,
      base: 'consumption',
      marketSize: 250_000_000_000 * scale,
      dedicated: false,
      linkedTrustFund: null,
      description:
        'State excise on alcohol sales within a realistic alcohol market — not all shopping.',
      destination: 'General regional budget.',
    },
    {
      id: `${prefix}_marijuana`,
      name: 'Marijuana Tax',
      enacted: prefix === 'west',
      rate: 0.15,
      base: 'consumption',
      marketSize: 32_000_000_000 * scale,
      dedicated: false,
      linkedTrustFund: null,
      description:
        'Tax on legal cannabis sales only. On by default in the West (where legal markets are largest).',
      destination: 'General regional budget.',
    },
    {
      id: `${prefix}_carbon`,
      name: 'Carbon Tax',
      enacted: false,
      rate: 0.005,
      base: 'gdp',
      dedicated: false,
      linkedTrustFund: null,
      description:
        'Optional climate levy as a small % of regional GDP. Off by default.',
      destination: 'General regional budget.',
    },
  ]
}

function regionDepartments(prefix: string, scale: number): Department[] {
  const line = (
    id: string,
    name: string,
    type: 'mandatory' | 'discretionary',
    amount: number,
    description: string,
    tf: string | null = null,
  ): Department => ({
    id: `${prefix}_${id}`,
    name,
    type,
    category: type === 'mandatory' ? 'Mandatory' : 'Discretionary',
    baseline: amount,
    allocated: amount,
    spent: 0,
    trustFundLinked: tf,
    description,
  })

  return [
    line(
      'education',
      'Education',
      'discretionary',
      280e9 * scale,
      'Public schools, universities, and student aid at the regional level.',
    ),
    line(
      'hhs',
      'Health & Human Services',
      'discretionary',
      220e9 * scale,
      'Hospitals, public health, and social services run by the region.',
    ),
    line(
      'transport',
      'Transportation',
      'discretionary',
      95e9 * scale,
      'State highways, roads, and transit — partly paid from the roads trust fund.',
      `${prefix}_tf_roads`,
    ),
    line(
      'public_safety',
      'Public Safety',
      'discretionary',
      85e9 * scale,
      'Police, fire, courts, and emergency response.',
    ),
    line(
      'infra',
      'Infrastructure',
      'discretionary',
      70e9 * scale,
      'Water, power, broadband, and major capital projects.',
    ),
    line(
      'unemployment',
      'Unemployment Insurance',
      'mandatory',
      45e9 * scale,
      'Temporary checks for laid-off workers from the unemployment trust fund.',
      `${prefix}_tf_ui`,
    ),
    line(
      'healthcare_tf',
      'State Health Programs',
      'mandatory',
      120e9 * scale,
      'State share of Medicaid-style and public health programs.',
      `${prefix}_tf_health`,
    ),
    line(
      'disaster',
      'Disaster Relief',
      'discretionary',
      18e9 * scale,
      'Regional emergency pot. Federal presidential relief is separate (national disaster fund).',
      `${prefix}_tf_disaster`,
    ),
    line(
      'other',
      'Other / General Government',
      'discretionary',
      55e9 * scale,
      'Legislature, governor’s office, and general administration.',
    ),
  ]
}

export function createRegion(
  id: 'west' | 'central' | 'east',
  nationalGdp: number,
  nationalPop: number,
): JurisdictionState {
  const meta = REGION_SHARES[id]
  const scale = meta.gdp
  return {
    id,
    name: meta.label,
    period: { fiscalYear: 2026, quarter: 1 },
    economy: {
      gdp: nationalGdp * meta.gdp,
      gdpGrowthRateAnnualized: 0,
      population: Math.round(nationalPop * meta.pop),
      unemploymentRate: id === 'central' ? 0.038 : id === 'west' ? 0.043 : 0.041,
      laborForceParticipation: 0.62,
      jobVacancyRate: 0.046,
    },
    treasury: {
      balance: 40e9 * scale,
      nationalDebt: (id === 'east' ? 980e9 : id === 'west' ? 420e9 : 185e9),
      netInterestRate: 0.034,
    },
    incomeTax: {
      mode: id === 'east' ? 'progressive' : 'flat',
      flatRate: id === 'west' ? 0.055 : id === 'central' ? 0.045 : 0.06,
      brackets: structuredClone(DEFAULT_STATE_BRACKETS),
      standardDeduction: 8_000,
      personalExemption: 0,
    },
    optionalTaxes: regionOptionalTaxes(id, scale),
    trustFunds: [
      {
        id: `${id}_tf_roads`,
        name: 'State Roads Trust Fund',
        balance: 12e9 * scale,
        fundedBy: 'Gas / Fuel Tax',
        spendsOn: 'Transportation',
      },
      {
        id: `${id}_tf_ui`,
        name: 'Unemployment Trust Fund',
        balance: 8e9 * scale,
        fundedBy: 'Payroll / UI contributions',
        spendsOn: 'Unemployment Insurance',
      },
      {
        id: `${id}_tf_health`,
        name: 'Health Care Trust Fund',
        balance: 15e9 * scale,
        fundedBy: 'State appropriations',
        spendsOn: 'State Health Programs',
      },
      {
        id: `${id}_tf_disaster`,
        name: 'Disaster Relief Trust Fund',
        balance: 10e9 * scale,
        fundedBy: 'Appropriations',
        spendsOn: 'Disaster Relief',
      },
    ],
    departments: regionDepartments(id, scale),
    federalGrant: 180e9 * scale, // revenue-sharing placeholder
    gdpShareOfNation: meta.gdp,
    priorYearDisasterAppropriation: 18e9 * scale,
  }
}

export const REGION_META = REGION_SHARES
