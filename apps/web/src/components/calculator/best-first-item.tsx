'use client'

import { useMemo, useState } from 'react'
import type { DebugDataset, DebugState } from '../../lib/debug-state'
import { bestFirstItems } from '../../lib/calculator'

const whole = (value: number) => Math.round(value).toLocaleString('en')

interface BestFirstItemProps {
  state: DebugState
  dataset: DebugDataset
}

/** Time to kill for every legendary item bought alone, ranked fastest kill first — computed on open, not on every edit. */
export function BestFirstItem({ state, dataset }: BestFirstItemProps) {
  const [open, setOpen] = useState(false)
  const result = useMemo(() => (open ? bestFirstItems(state, dataset) : null), [open, state, dataset])

  return (
    <details className="stats-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Best first item (every legendary, bought alone)</summary>
      {result !== null && !result.ok && <p role="alert">{result.error}</p>}
      {result !== null && result.ok && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Item</th><th className="num">Gold</th><th className="num">DPS</th><th className="num">TTK</th></tr>
            </thead>
            <tbody>
              {result.value.map((row) => (
                <tr key={row.itemId}>
                  <td>{row.itemName}</td>
                  <td className="num">{whole(row.cost)}</td>
                  <td className="num">{whole(row.dps)}</td>
                  <td className="num">
                    {row.timeToKill === undefined ? <span className="muted">doesn&apos;t kill</span> : `${row.timeToKill.toFixed(1)}s`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}
