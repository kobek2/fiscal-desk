import type { EconomyState } from '../economy'
import { formatMoney } from '../economy'

interface Props {
  state: EconomyState
}

export function Ledger({ state }: Props) {
  return (
    <section className="panel ledger">
      <header>
        <p className="eyebrow">Activity</p>
        <h2>Ledger</h2>
      </header>
      <ul>
        {state.log.slice(0, 40).map((entry) => (
          <li key={entry.id} className={`log-${entry.kind}`}>
            <div className="log-top">
              <strong>{entry.title}</strong>
              <time dateTime={entry.at}>
                {new Date(entry.at).toLocaleString()}
              </time>
            </div>
            <p>{entry.detail}</p>
            {entry.amounts && (
              <p className="log-amounts">
                {Object.entries(entry.amounts)
                  .map(([k, v]) => `${k}: ${formatMoney(v ?? 0)}`)
                  .join(' · ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
