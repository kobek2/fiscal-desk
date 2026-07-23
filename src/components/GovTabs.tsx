import type { EconomyState, GovId } from '../economy'
import { formatMoney, projectBudget } from '../economy'

export type AppView = GovId | 'admin'

interface Props {
  state: EconomyState
  selected: AppView
  onSelect: (id: AppView) => void
}

const TABS: { id: AppView; label: string }[] = [
  { id: 'federal', label: 'Federal' },
  { id: 'west', label: 'Western Region' },
  { id: 'east', label: 'Eastern Region' },
  { id: 'central', label: 'Central Region' },
  { id: 'admin', label: 'Admin' },
]

export function GovTabs({ state, selected, onSelect }: Props) {
  const joinsReady = state.membership.joinsThisYear != null

  return (
    <div className="gov-tabs" role="tablist" aria-label="Governments">
      {TABS.map((tab) => {
        if (tab.id === 'admin') {
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected === 'admin'}
              className={`gov-tab gov-tab-admin ${selected === 'admin' ? 'active' : ''} ${joinsReady ? '' : 'needs-attention'}`}
              onClick={() => onSelect('admin')}
            >
              <span className="tab-name">{tab.label}</span>
              <span className={`tab-balance ${joinsReady ? 'surplus' : 'deficit'}`}>
                {joinsReady
                  ? `${state.membership.joinsThisYear} joins`
                  : 'Record joins'}
              </span>
            </button>
          )
        }

        const gov = state.governments[tab.id]
        const { balance } = projectBudget(gov)
        const status =
          balance > gov.economy.gdp * 0.01
            ? 'surplus'
            : balance < -gov.economy.gdp * 0.01
              ? 'deficit'
              : 'balanced'
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected === tab.id}
            className={`gov-tab gov-tab-${tab.id} ${selected === tab.id ? 'active' : ''}`}
            onClick={() => onSelect(tab.id)}
          >
            <span className="tab-name">{tab.label}</span>
            <span className={`tab-balance ${status}`}>
              {status === 'balanced'
                ? 'Near balance'
                : `${formatMoney(balance)}/yr`}
            </span>
          </button>
        )
      })}
    </div>
  )
}
