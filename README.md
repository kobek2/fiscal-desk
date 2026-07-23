# Fiscal Desk — Political Discord Budget Sim

Population-level budget simulator modeled after **The Political Process**: federal + three regions, seeded with FY2025–26 U.S. fiscal anchors. Not tied to Unbelievaboat balances.

## Run

```bash
npm install
npm run dev
```

State saves in `localStorage` (`discord-budget-sim-v3`).

## Spec decisions locked in

| Open param | Choice |
|---|---|
| Net interest rate | **3.2%** federal |
| GDP growth | **Admin lever** + small policy nudge on submit |
| Balance Budget | **Proportional discretionary cuts** (with confirm) |
| Period cadence | **Quarterly** |
| Regional split | Weighted by GDP/pop (West ~26%, East ~56%, Central ~18%) |

## What’s implemented

- Progressive / flat income tax via AGI distribution bands (not per-citizen)
- Optional taxes: True/False + rate + live yield; dedicated → trust funds
- Payroll → SS & Medicare trust funds; gas/vehicle → Highway Trust Fund
- Mandatory vs discretionary departments with baseline / allocated / status
- Trust-fund draw-down before general fund
- Fiscal stance from deficit % of GDP; debt/GDP flags; year-end debt path
- Live right-hand summary (revenue / expenditure / treasury / trust funds)
- Balance Budget + Submit Budget (closes quarter)
- Disaster events draw regional + federal disaster trust funds by GDP % severity

## Layout

Top gov tabs → KPI strip → sidebar / center editor / live summary → events → ledger.
