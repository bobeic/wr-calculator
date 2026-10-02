'use client'

import type { Champion } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'
import type { DebugBuild } from '../lib/debug-state'
import { collectInputs } from '../lib/collect-inputs'
import { EffectInputs } from './effect-inputs'
import { summarizeBuild } from '../lib/build-summary'

interface BuildEditorProps {
  label: string
  build: DebugBuild
  catalog: StatCatalog
  /** The champion using the build; its kit's inputs are listed with the build's. */
  champion?: Champion
  onChange: (build: DebugBuild) => void
}

/** Edits one build: ordered items, boots, runes, and the effect inputs its items declare. */
export function BuildEditor({ label, build, catalog, champion, onChange }: BuildEditorProps) {
  const allItems = [...catalog.items.values()]
  const boots = allItems.filter((item) => item.tier === 'boots')
  const nonBoots = allItems.filter((item) => item.tier !== 'boots')
  const runes = [...catalog.runes.values()]
  const spells = [...(catalog.spells?.values() ?? [])]
  const inputs = collectInputs(build, catalog, champion)
  const summary = summarizeBuild(build, catalog)
  const efficiency = (index: number): string => {
    const value = summary.items[index]?.efficiency
    return value === null || value === undefined ? '' : `, ${Math.round(value * 100)}% stat value`
  }

  const move = (index: number, delta: number) => {
    const items = [...build.items]
    const [moved] = items.splice(index, 1)
    items.splice(index + delta, 0, moved)
    onChange({ ...build, items })
  }
  const setBoots = (id: string) => {
    const next: DebugBuild = { items: build.items, runes: build.runes, inputs: build.inputs }
    if (build.spells !== undefined) next.spells = build.spells
    if (id !== '') next.boots = id
    onChange(next)
  }
  const toggleRune = (id: string) => onChange({
    ...build,
    runes: build.runes.includes(id) ? build.runes.filter((rune) => rune !== id) : [...build.runes, id],
  })
  const toggleSpell = (id: string) => {
    const current = build.spells ?? []
    const spells = current.includes(id) ? current.filter((spell) => spell !== id) : [...current, id]
    const { spells: _dropped, ...rest } = build
    onChange(spells.length > 0 ? { ...rest, spells } : rest)
  }
  const setInput = (id: string, value: number | boolean) => onChange({
    ...build, inputs: { ...build.inputs, [id]: value },
  })

  return (
    <fieldset>
      <legend>{label}</legend>
      <ol>
        {build.items.map((id, index) => (
          <li key={`${id}-${index}`}>
            {catalog.items.get(id)?.name ?? id} ({catalog.items.get(id)?.cost.total ?? '?'}g{efficiency(index)}){' '}
            <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" disabled={index === build.items.length - 1} onClick={() => move(index, 1)}>↓</button>
            <button type="button" onClick={() => onChange({ ...build, items: build.items.filter((_, i) => i !== index) })}>
              remove
            </button>
          </li>
        ))}
      </ol>
      <label>
        Add item{' '}
        <select value="" onChange={(event) => {
          if (event.target.value !== '') onChange({ ...build, items: [...build.items, event.target.value] })
        }}>
          <option value="">—</option>
          {nonBoots.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.cost.total}g)</option>)}
        </select>
      </label>{' '}
      <label>
        Boots{' '}
        <select value={build.boots ?? ''} onChange={(event) => setBoots(event.target.value)}>
          <option value="">none</option>
          {boots.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.cost.total}g)</option>)}
        </select>
      </label>
      <p>Total cost: {summary.totalCost}g (stat value counts stats only, priced from basic items)</p>
      {summary.issues.length > 0 && (
        <ul>
          {summary.issues.map((issue, index) => <li key={`${index}-${issue.code}`} role="alert">{issue.message}</li>)}
        </ul>
      )}
      {runes.length === 0 ? <p>Runes: no runes in the patch data yet</p> : (
        <p>
          Runes:{' '}
          {runes.map((rune) => (
            <label key={rune.id}>
              <input type="checkbox" checked={build.runes.includes(rune.id)} onChange={() => toggleRune(rune.id)} />
              {rune.name}{' '}
            </label>
          ))}
        </p>
      )}
      {spells.length > 0 && (
        <p>
          Summoner spells (cast with spell:id in the combo):{' '}
          {spells.map((spell) => (
            <label key={spell.id}>
              <input type="checkbox" checked={(build.spells ?? []).includes(spell.id)} onChange={() => toggleSpell(spell.id)} />
              {spell.name}{' '}
            </label>
          ))}
        </p>
      )}
      {inputs.length > 0 && (
        <p>
          Effect inputs:{' '}
          <EffectInputs inputs={inputs} values={build.inputs} onChange={setInput} />
        </p>
      )}
    </fieldset>
  )
}
