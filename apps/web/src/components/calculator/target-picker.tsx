'use client'

import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import type { DebugDataset, DebugTarget } from '../../lib/debug-state'
import { emptyBuild } from '../../lib/debug-state'
import { BuildPanel } from './build-panel'

interface TargetPickerProps {
  target: DebugTarget
  dataset: DebugDataset
  onChange: (target: DebugTarget) => void
}

function NumberField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return (
    <label className="number-field">
      {label}
      <input type="number" min={min} value={value} onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next) && next >= min) onChange(next)
      }} />
    </label>
  )
}

/** Who takes the damage: a preset dummy, a custom dummy, or a champion with its own items. */
export function TargetPicker({ target, dataset, onChange }: TargetPickerProps) {
  const champions = [...dataset.champions.values()]
  return (
    <div className="target-picker">
      <div className="filters" role="group" aria-label="Target">
        {dataset.targets.map((preset) => (
          <button
            key={preset.id} type="button" aria-pressed={target.kind === 'preset' && target.presetId === preset.id}
            title={`${preset.target.hp} HP, ${preset.target.armor} armor, ${preset.target.mr} MR`}
            onClick={() => onChange({ kind: 'preset', presetId: preset.id })}
          >
            {preset.name}
          </button>
        ))}
        <button type="button" aria-pressed={target.kind === 'dummy'} onClick={() => onChange({ kind: 'dummy', hp: 2000, armor: 50, mr: 50 })}>
          Custom
        </button>
        <button
          type="button" aria-pressed={target.kind === 'champion'}
          onClick={() => onChange({ kind: 'champion', championId: champions[0]?.id ?? '', level: MAX_CHAMPION_LEVEL, build: emptyBuild() })}
        >
          Champion
        </button>
      </div>
      {target.kind === 'dummy' && (
        <div className="field-row">
          <NumberField label="HP" value={target.hp} min={1} onChange={(hp) => onChange({ ...target, hp })} />
          <NumberField label="Armor" value={target.armor} min={0} onChange={(armor) => onChange({ ...target, armor })} />
          <NumberField label="MR" value={target.mr} min={0} onChange={(mr) => onChange({ ...target, mr })} />
        </div>
      )}
      {target.kind === 'champion' && (
        <>
          <div className="field-row">
            <label className="number-field">
              Champion
              <select value={target.championId} onChange={(event) => onChange({ ...target, championId: event.target.value })}>
                {champions.map((champion) => <option key={champion.id} value={champion.id}>{champion.name}</option>)}
              </select>
            </label>
            <NumberField
              label="Level" value={target.level} min={1}
              onChange={(level) => { if (Number.isInteger(level) && level <= MAX_CHAMPION_LEVEL) onChange({ ...target, level }) }}
            />
          </div>
          <details>
            <summary>Target&apos;s items ({target.build.items.length + (target.build.boots === undefined ? 0 : 1)})</summary>
            <BuildPanel
              build={target.build} catalog={dataset.catalog} champion={dataset.champions.get(target.championId)}
              onChange={(build) => onChange({ ...target, build })}
            />
          </details>
        </>
      )}
    </div>
  )
}
