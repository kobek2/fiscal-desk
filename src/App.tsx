import { useState } from 'react'
import type { GovId } from './economy'
import { GovTabs } from './components/GovTabs'
import { BudgetWorkspace } from './components/BudgetWorkspace'
import { DisasterFundPanel } from './components/DisasterFundPanel'
import { BillExport } from './components/BillExport'
import { Ledger } from './components/Ledger'
import { AdminDashboard } from './components/AdminDashboard'
import { useEconomy } from './useEconomy'
import './App.css'

type AppView = GovId | 'admin'

function App() {
  const { state, setState, reset } = useEconomy()
  const [selected, setSelected] = useState<AppView>('federal')

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden />
      <nav className="topbar">
        <div className="brand">
          <span className="brand-mark">Fiscal Desk</span>
          <span className="brand-sub">Political Discord Budget Sim</span>
        </div>
        <div className="topbar-actions">
          <span className="fy-chip">FY {state.period.fiscalYear}</span>
          <button type="button" className="btn ghost" onClick={reset}>
            Reset baselines
          </button>
        </div>
      </nav>

      <main>
        <GovTabs
          state={state}
          selected={selected}
          onSelect={setSelected}
        />
        {selected === 'admin' ? (
          <AdminDashboard state={state} onChange={setState} />
        ) : (
          <>
            <BudgetWorkspace
              state={state}
              govId="federal"
              onChange={setState}
            />
            <DisasterFundPanel state={state} onChange={setState} />
            <BillExport state={state} govId="federal" />
          </>
        )}
        <Ledger state={state} />
      </main>
    </div>
  )
}

export default App
