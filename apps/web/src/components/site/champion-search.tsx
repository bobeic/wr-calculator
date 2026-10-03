'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { championHref } from '../../lib/site/format'
import { SearchIcon } from './icons'

export interface ChampionSearchProps {
  champions: Array<{ id: string; name: string }>
}

const fold = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Jump to a champion's page: the browser's own suggestion list, Enter takes the best match. */
export function ChampionSearch({ champions }: ChampionSearchProps) {
  const router = useRouter()
  const find = (query: string) => {
    const needle = fold(query)
    if (needle === '') return undefined
    return champions.find((champion) => fold(champion.name) === needle)
      ?? champions.find((champion) => fold(champion.name).startsWith(needle))
      ?? champions.find((champion) => fold(champion.name).includes(needle))
  }
  const go = (query: string) => {
    const match = find(query)
    if (match) router.push(championHref(match.id))
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    go(String(new FormData(event.currentTarget).get('q') ?? ''))
  }

  return (
    <form className="champ-search" role="search" onSubmit={submit}>
      <label htmlFor="champ-search-input" className="sr-only">Find a champion</label>
      <SearchIcon />
      <input
        id="champ-search-input" name="q" type="search" list="champion-names" autoComplete="off" placeholder="Find a champion"
        // Picking a suggestion (not typing: "Vi" is a prefix of "Viego") goes straight there.
        onChange={(event) => {
          const picked = (event.nativeEvent as InputEvent).inputType
          if ((picked === undefined || picked === 'insertReplacementText') && champions.some((champion) => champion.name === event.target.value)) go(event.target.value)
        }}
      />
      <datalist id="champion-names">
        {champions.map((champion) => <option key={champion.id} value={champion.name} />)}
      </datalist>
      <button type="submit">Go</button>
    </form>
  )
}
