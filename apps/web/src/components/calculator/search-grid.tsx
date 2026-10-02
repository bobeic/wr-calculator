'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'

export interface GridEntry {
  id: string
  name: string
  /** Small text after the name, e.g. a price. */
  detail?: string
  tag?: string
  disabled?: boolean
  selected?: boolean
}

interface SearchGridProps {
  label: string
  entries: GridEntry[]
  onPick: (id: string) => void
  /** Filter chips shown next to the search box. */
  filters?: ReactNode
}

/** A search box over a grid of buttons; typing narrows the grid by name. */
export function SearchGrid({ label, entries, onPick, filters }: SearchGridProps) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = needle === '' ? entries : entries.filter((entry) => entry.name.toLowerCase().includes(needle))
  return (
    <div className="search-grid">
      <div className="search-grid-bar">
        <input
          type="search" placeholder={`Search ${label.toLowerCase()}`} aria-label={`Search ${label.toLowerCase()}`}
          value={query} onChange={(event) => setQuery(event.target.value)}
        />
        {filters}
      </div>
      {shown.length === 0 ? <p className="note">Nothing matches “{query}”.</p> : (
        <div className="pick-grid" role="group" aria-label={label}>
          {shown.map((entry) => (
            <button
              key={entry.id} type="button" className="pick" disabled={entry.disabled}
              aria-pressed={entry.selected ?? false} onClick={() => onPick(entry.id)}
            >
              <span className="pick-name">{entry.name}</span>
              {entry.tag !== undefined && <span className="tag">{entry.tag}</span>}
              {entry.detail !== undefined && <span className="pick-detail">{entry.detail}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
