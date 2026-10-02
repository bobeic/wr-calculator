'use client'

import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import type { DebugDataset, DebugTarget } from '../lib/debug-state'
import { emptyBuild } from '../lib/debug-state'
import { BuildEditor } from './build-editor'

const TARGET_KINDS: readonly DebugTarget['kind'][] = ['preset', 'dummy', 'champion']

function freshTarget(kind: DebugTarget['kind'], dataset: DebugDataset): DebugTarget {
  switch (kind) {
    case 'preset':
      return { kind, presetId: dataset.targets[0]?.id ?? '' }
    case 'dummy':
      return { kind, hp: 2000, armor: 50, mr: 50 }
    case 'champion':
      return { kind, championId: [...dataset.champions.keys()][0] ?? '', level: MAX_CHAMPION_LEVEL, build: emptyBuild() }
  }
}

interface TargetEditorProps {
  target: DebugTarget
  dataset: DebugDataset
  onChange: (target: DebugTarget) => void
}

/** Picks the combat target: a preset dummy, a custom dummy, or a champion with its own build. */
export function TargetEditor({ target, dataset, onChange }: TargetEditorProps) {
  const numberField = (label: string, value: number, apply: (next: number) => void) => (
    <label>
      {label}{' '}
      <input type="number" value={value} onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next)) apply(next)
      }} />{' '}
    </label>
  )

  return (
    <fieldset>
      <legend>Target</legend>
      <label>
        Kind{' '}
        <select value={target.kind} onChange={(event) => {
          const kind = TARGET_KINDS.find((candidate) => candidate === event.target.value)
          if (kind) onChange(freshTarget(kind, dataset))
        }}>
          {TARGET_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
      </label>{' '}
      {target.kind === 'preset' && (
        <select value={target.presetId} onChange={(event) => onChange({ kind: 'preset', presetId: event.target.value })}>
          {dataset.targets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}: {preset.target.hp} hp / {preset.target.armor} armor / {preset.target.mr} mr
              {preset.provenance.verifiedInGame ? '' : ' (unverified)'}
            </option>
          ))}
        </select>
      )}
      {target.kind === 'dummy' && (
        <>
          {numberField('HP', target.hp, (hp) => { if (hp > 0) onChange({ ...target, hp }) })}
          {numberField('Armor', target.armor, (armor) => onChange({ ...target, armor }))}
          {numberField('MR', target.mr, (mr) => onChange({ ...target, mr }))}
        </>
      )}
      {target.kind === 'champion' && (
        <>
          <select value={target.championId} onChange={(event) => onChange({ ...target, championId: event.target.value })}>
            {[...dataset.champions.values()].map((champion) => (
              <option key={champion.id} value={champion.id}>{champion.name}</option>
            ))}
          </select>{' '}
          {numberField('Level', target.level, (level) => {
            if (Number.isInteger(level) && level >= 1 && level <= MAX_CHAMPION_LEVEL) onChange({ ...target, level })
          })}
          <BuildEditor
            label="Target build" build={target.build} catalog={dataset.catalog}
            champion={dataset.champions.get(target.championId)}
            onChange={(build) => onChange({ ...target, build })}
          />
        </>
      )}
    </fieldset>
  )
}
