'use client'

import { useState } from 'react'
import type { Champion } from '@wr-calc/schema'
import { SearchGrid } from './search-grid'

interface ChampionPickerProps {
  champions: Champion[]
  selectedId: string
  /** Champions with a hand-written kit; the rest use auto-imported ability numbers. */
  modelledIds: ReadonlySet<string>
  onPick: (id: string) => void
}

/** The selected champion, with a searchable grid to change it. */
export function ChampionPicker({ champions, selectedId, modelledIds, onPick }: ChampionPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = champions.find((champion) => champion.id === selectedId)
  return (
    <div className="champion-picker">
      <div className="picked">
        <strong>{selected?.name ?? selectedId}</strong>
        {modelledIds.has(selectedId)
          ? <span className="tag">full kit</span>
          : <span className="tag" title="Ability numbers imported automatically; passives and extra effects are missing">rough kit</span>}
        <button type="button" className="link-button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Change'}
        </button>
      </div>
      {open && (
        <SearchGrid
          label="Champions"
          entries={champions.map((champion) => ({
            id: champion.id, name: champion.name, selected: champion.id === selectedId,
            ...(modelledIds.has(champion.id) && { tag: 'full kit' }),
          }))}
          onPick={(id) => {
            onPick(id)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}
