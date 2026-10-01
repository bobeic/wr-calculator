'use client'

import type { StatCatalog } from '@wr-calc/calc'
import type { DebugBuild } from '../lib/debug-state'
import { collectInputs, inputValue } from '../lib/collect-inputs'

interface BuildEditorProps {
  label: string
  build: DebugBuild
  catalog: StatCatalog
  onChange: (build: DebugBuild) => void
}

/** Edits one build: ordered items, boots, runes, and the effect inputs its items declare. */
export function BuildEditor({ label, build, catalog, onChange }: BuildEditorProps) {
  const allItems = [...catalog.items.values()]
  const boots = allItems.filter((item) => item.tier === 'boots')
  const nonBoots = allItems.filter((item) => item.tier !== 'boots')
  const runes = [...catalog.runes.values()]
  const inputs = collectInputs(build, catalog)

  const move = (index: number, delta: number) => {
    const items = [...build.items]
    const [moved] = items.splice(index, 1)
    items.splice(index + delta, 0, moved)
    onChange({ ...build, items })
  }
  const setBoots = (id: string) => {
    const next: DebugBuild = { items: build.items, runes: build.runes, inputs: build.inputs }
    if (id !== '') next.boots = id
    onChange(next)
  }
  const toggleRune = (id: string) => onChange({
    ...build,
    runes: build.runes.includes(id) ? build.runes.filter((rune) => rune !== id) : [...build.runes, id],
  })
  const setInput = (id: string, value: number | boolean) => onChange({
    ...build, inputs: { ...build.inputs, [id]: value },
  })

  return (
    <fieldset>
      <legend>{label}</legend>
      <ol>
        {build.items.map((id, index) => (
          <li key={`${id}-${index}`}>
            {catalog.items.get(id)?.name ?? id}{' '}
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
      {inputs.length > 0 && (
        <p>
          Effect inputs:{' '}
          {inputs.map((input) => {
            const value = inputValue(input, build.inputs)
            return input.type === 'stackCount' ? (
              <label key={input.id}>
                {input.label}{' '}
                <input
                  type="number" min={input.min} max={input.max}
                  value={typeof value === 'number' ? value : input.default}
                  onChange={(event) => {
                    const stacks = Number(event.target.value)
                    if (Number.isFinite(stacks)) setInput(input.id, Math.min(input.max, Math.max(input.min, stacks)))
                  }}
                />{' '}
              </label>
            ) : (
              <label key={input.id}>
                <input type="checkbox" checked={value === true} onChange={(event) => setInput(input.id, event.target.checked)} />
                {input.label}{' '}
              </label>
            )
          })}
        </p>
      )}
    </fieldset>
  )
}
