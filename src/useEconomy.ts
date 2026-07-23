import { useCallback, useEffect, useState } from 'react'
import {
  createInitialState,
  DEFAULT_MEMBERSHIP,
  type EconomyState,
} from './economy'

const STORAGE_KEY = 'discord-budget-sim-v11'

function migrate(raw: unknown): EconomyState {
  const base = createInitialState()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<EconomyState> & {
    governments?: Partial<EconomyState['governments']> & {
      west?: unknown
      east?: unknown
      central?: unknown
    }
  }

  const federal = data.governments?.federal ?? base.governments.federal
  const eco = federal.economy as typeof federal.economy & {
    approvalRating?: number
  }
  if ('approvalRating' in eco) delete eco.approvalRating

  return {
    period: data.period ?? base.period,
    governments: { federal },
    membership: {
      ...DEFAULT_MEMBERSHIP,
      ...(data.membership ?? {}),
    },
    log: data.log ?? base.log,
  }
}

export function loadState(): EconomyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrate(JSON.parse(raw))
    // One-time lift from prior key if present
    const legacy = localStorage.getItem('discord-budget-sim-v8')
    if (legacy) return migrate(JSON.parse(legacy))
  } catch {
    /* ignore */
  }
  return createInitialState()
}

export function saveState(state: EconomyState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useEconomy() {
  const [state, setState] = useState<EconomyState>(() => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  const reset = useCallback(() => {
    if (confirm('Reset the entire sim to FY2028 baselines?')) {
      setState(createInitialState())
    }
  }, [])

  return { state, setState, reset }
}
