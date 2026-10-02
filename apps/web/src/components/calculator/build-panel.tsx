'use client'

import { useState } from 'react'
import type { Champion, Item } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'
import { ITEM_SLOTS, SUMMONER_SPELL_SLOTS } from '@wr-calc/calc'
import type { DebugBuild } from '../../lib/debug-state'
import { collectInputs } from '../../lib/collect-inputs'
import { summarizeBuild } from '../../lib/build-summary'
import { EffectInputs } from '../effect-inputs'
import { SearchGrid } from './search-grid'

const ITEM_TABS: ReadonlyArray<{ tier: Item['tier']; label: string }> = [
  { tier: 'legendary', label: 'Legendary' },
  { tier: 'boots', label: 'Boots' },
  { tier: 'epic', label: 'Epic' },
  { tier: 'basic', label: 'Basic' },
  { tier: 'support', label: 'Support' },
]
// Components may repeat in a build; finished items may not (validateBuild).
const REPEATABLE: ReadonlySet<Item['tier']> = new Set(['basic', 'epic'])

interface BuildPanelProps {
  build: DebugBuild
  catalog: StatCatalog
  /** The champion using the build: its kit's inputs are listed too. */
  champion?: Champion
  onChange: (build: DebugBuild) => void
}

/** Item slots, boots, runes, summoner spells and effect inputs for one build, with a searchable item grid. */
export function BuildPanel({ build, catalog, champion, onChange }: BuildPanelProps) {
  const [tier, setTier] = useState<Item['tier']>('legendary')
  const summary = summarizeBuild(build, catalog)
  const inputs = collectInputs(build, catalog, champion)
  const full = build.items.length >= ITEM_SLOTS
  const name = (id: string) => catalog.items.get(id)?.name ?? id

  const pickItem = (id: string) => {
    const item = catalog.items.get(id)
    if (item === undefined) return
    if (item.tier === 'boots') onChange({ ...build, boots: id })
    else if (!full) onChange({ ...build, items: [...build.items, id] })
  }
  const removeItem = (index: number) => onChange({ ...build, items: build.items.filter((_, i) => i !== index) })
  const removeBoots = () => {
    const { boots: _dropped, ...rest } = build
    onChange(rest)
  }
  const toggleRune = (id: string) => onChange({
    ...build, runes: build.runes.includes(id) ? build.runes.filter((rune) => rune !== id) : [...build.runes, id],
  })
  const spells = build.spells ?? []
  const toggleSpell = (id: string) => {
    const next = spells.includes(id) ? spells.filter((spell) => spell !== id) : [...spells, id]
    const { spells: _dropped, ...rest } = build
    onChange(next.length > 0 ? { ...rest, spells: next } : rest)
  }

  const items = [...catalog.items.values()].filter((item) => item.tier === tier)
  const runesByPath = new Map<string, Array<{ id: string; name: string }>>()
  for (const rune of catalog.runes.values()) runesByPath.set(rune.path, [...(runesByPath.get(rune.path) ?? []), rune])

  return (
    <div className="build-panel">
      <ol className="slots" aria-label="Items">
        {Array.from({ length: ITEM_SLOTS }, (_, index) => {
          const id = build.items[index]
          return (
            <li key={index} className={id === undefined ? 'slot empty' : 'slot'}>
              {id === undefined ? <span className="muted">Empty</span> : (
                <>
                  <span>{name(id)}</span>
                  <button type="button" className="slot-remove" aria-label={`Remove ${name(id)}`} onClick={() => removeItem(index)}>×</button>
                </>
              )}
            </li>
          )
        })}
        <li className={build.boots === undefined ? 'slot empty boots' : 'slot boots'}>
          {build.boots === undefined ? <span className="muted">No boots</span> : (
            <>
              <span>{name(build.boots)}</span>
              <button type="button" className="slot-remove" aria-label={`Remove ${name(build.boots)}`} onClick={removeBoots}>×</button>
            </>
          )}
        </li>
      </ol>
      <p className="note">
        {summary.totalCost.toLocaleString('en')} gold
        {full && ' · all item slots are full; remove one to add another'}
      </p>
      {summary.issues.length > 0 && (
        <ul className="issues">
          {summary.issues.map((issue, index) => <li key={`${index}-${issue.code}`} role="alert">{issue.message}</li>)}
        </ul>
      )}

      <SearchGrid
        label="Items"
        filters={(
          <div className="filters" role="group" aria-label="Item type">
            {ITEM_TABS.map((tab) => (
              <button key={tab.tier} type="button" aria-pressed={tier === tab.tier} onClick={() => setTier(tab.tier)}>{tab.label}</button>
            ))}
          </div>
        )}
        entries={items.map((item) => {
          const owned = build.items.includes(item.id) || build.boots === item.id
          return {
            id: item.id, name: item.name, detail: `${item.cost.total}g`, selected: owned,
            disabled: item.tier === 'boots' ? build.boots === item.id : full || (owned && !REPEATABLE.has(item.tier)),
          }
        })}
        onPick={pickItem}
      />

      <details className="extras">
        <summary>Runes ({build.runes.length}) and summoner spells ({spells.length})</summary>
        {[...runesByPath].map(([path, runes]) => (
          <div key={path} className="chip-row">
            <span className="chip-label">{path}</span>
            {runes.map((rune) => (
              <button key={rune.id} type="button" className="chip" aria-pressed={build.runes.includes(rune.id)} onClick={() => toggleRune(rune.id)}>
                {rune.name}
              </button>
            ))}
          </div>
        ))}
        <div className="chip-row">
          <span className="chip-label">Spells</span>
          {[...(catalog.spells?.values() ?? [])].map((spell) => (
            <button
              key={spell.id} type="button" className="chip" aria-pressed={spells.includes(spell.id)}
              disabled={!spells.includes(spell.id) && spells.length >= SUMMONER_SPELL_SLOTS}
              onClick={() => toggleSpell(spell.id)}
            >
              {spell.name}
            </button>
          ))}
        </div>
        <p className="note">A spell only deals damage when the combo casts it, e.g. <code>spell:ignite</code>.</p>
      </details>

      {inputs.length > 0 && (
        <fieldset className="inputs">
          <legend>Situation</legend>
          <EffectInputs
            inputs={inputs} values={build.inputs} className="input-row"
            onChange={(id, value) => onChange({ ...build, inputs: { ...build.inputs, [id]: value } })}
          />
        </fieldset>
      )}
    </div>
  )
}
