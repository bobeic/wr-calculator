'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import { CURRENT_PATCH } from '@wr-calc/data'
import { CURRENT_DATASET } from '../../lib/dataset'
import { MAX_DURATION_SECONDS, RANK_SLOTS, emptyBuild } from '../../lib/debug-state'
import type { DebugBuild, DebugState } from '../../lib/debug-state'
import { decodeState, encodeState } from '../../lib/url-state'
import { isEmptyBuild, runCalculator } from '../../lib/calculator'
import { ChampionPicker } from './champion-picker'
import { BuildPanel } from './build-panel'
import { TargetPicker } from './target-picker'
import { Results } from './results'

const dataset = CURRENT_DATASET
const champions = [...dataset.champions.values()].sort((left, right) => left.name.localeCompare(right.name))

/** What a link without these parameters opens: a champion with a full kit and a combo of every ability. */
const DEFAULT_CHAMPION = 'ambessa'
const DEFAULT_COMBO = 'Q W E R AA'

interface CalculatorPageProps {
  /** Champions with a hand-written kit. */
  modelledIds: readonly string[]
}

/** The build calculator: pick a champion, level, target and up to two builds; see damage per ability and time to kill. */
export function CalculatorPage({ modelledIds }: CalculatorPageProps) {
  const searchParams = useSearchParams()
  const [initial] = useState(() => {
    const decoded = decodeState(searchParams, dataset)
    const state: DebugState = {
      ...decoded.state,
      ...(searchParams.get('champ') === null && dataset.champions.has(DEFAULT_CHAMPION) && { championId: DEFAULT_CHAMPION }),
      ...(searchParams.get('combo') === null && { combo: DEFAULT_COMBO }),
    }
    return { state, issues: decoded.issues }
  })
  const [state, setState] = useState<DebugState>(initial.state)
  const [compare, setCompare] = useState(() => !isEmptyBuild(initial.state.buildB))
  const [editing, setEditing] = useState<'a' | 'b'>('a')
  const [copied, setCopied] = useState(false)

  // Same approach as the debug page: native replaceState after the first edit (see DebugPage for why).
  useEffect(() => {
    if (state === initial.state) return
    window.history.replaceState(null, '', `?${encodeState(state)}`)
  }, [initial.state, state])

  const report = useMemo(() => runCalculator(state, dataset, compare), [state, compare])
  const modelled = useMemo(() => new Set(modelledIds), [modelledIds])
  const update = (patch: Partial<DebugState>) => setState((current) => ({ ...current, ...patch }))
  const champion = dataset.champions.get(state.championId)
  const editedBuild = editing === 'a' ? state.buildA : state.buildB
  const setEditedBuild = (build: DebugBuild) => update(editing === 'a' ? { buildA: build } : { buildB: build })

  const startCompare = () => {
    // Build B starts as a copy of A, so changing one item shows that item's effect.
    if (isEmptyBuild(state.buildB)) update({ buildB: structuredClone(state.buildA) })
    setCompare(true)
    setEditing('b')
  }
  const stopCompare = () => {
    update({ buildB: emptyBuild() })
    setCompare(false)
    setEditing('a')
  }
  const copyLink = () => {
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="calculator">
      <div className="calc-title">
        <h1>Damage calculator</h1>
        <button type="button" className="link-button" onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
      </div>
      <p className="note">
        Patch {CURRENT_PATCH}. Numbers are the engine&apos;s predictions and mostly unchecked in game. Champions marked
        &ldquo;rough kit&rdquo; use auto-imported ability numbers without their passives.
      </p>
      {initial.issues.length > 0 && (
        <ul className="issues">{initial.issues.map((issue) => <li key={issue} role="alert">Link: {issue}</li>)}</ul>
      )}

      <div className="calc-layout">
        <section className="calc-setup" aria-label="Setup">
          <h2>Champion</h2>
          <ChampionPicker champions={champions} selectedId={state.championId} modelledIds={modelled} onPick={(championId) => update({ championId, abilityRanks: {} })} />
          <label className="level">
            Level <strong>{state.level}</strong>
            <input
              type="range" min={1} max={MAX_CHAMPION_LEVEL} value={state.level}
              onChange={(event) => update({ level: Number(event.target.value) })}
            />
          </label>

          <div className="field-row">
            <span className="chip-label">Ability ranks (blank = max)</span>
            {RANK_SLOTS.map((slot) => {
              const maxRank = champion?.abilities[slot].maxRank
              return (
                <label key={slot} className="number-field">
                  {slot.toUpperCase()}
                  <input
                    type="number" min={1} max={maxRank} placeholder={maxRank !== undefined ? String(maxRank) : ''}
                    value={state.abilityRanks[slot] ?? ''}
                    onChange={(event) => {
                      const { [slot]: _, ...rest } = state.abilityRanks
                      const rank = Number(event.target.value)
                      update({ abilityRanks: event.target.value === '' || !Number.isInteger(rank) || rank < 1 ? rest : { ...rest, [slot]: rank } })
                    }}
                  />
                </label>
              )
            })}
          </div>

          <h2>Target</h2>
          <TargetPicker target={state.target} dataset={dataset} onChange={(target) => update({ target })} />

          <div className="build-tabs" role="tablist" aria-label="Builds">
            <button type="button" role="tab" aria-selected={editing === 'a'} onClick={() => setEditing('a')}>Build A</button>
            {compare
              ? (
                <>
                  <button type="button" role="tab" aria-selected={editing === 'b'} onClick={() => setEditing('b')}>Build B</button>
                  <button type="button" className="link-button" onClick={stopCompare}>Remove build B</button>
                </>
              )
              : <button type="button" className="link-button" onClick={startCompare}>+ Compare with another build</button>}
          </div>
          <BuildPanel build={editedBuild} catalog={dataset.catalog} champion={champion} onChange={setEditedBuild} />

          <details className="rotation">
            <summary>Combo and rotation</summary>
            <label className="text-field">
              Combo <small className="muted">AA, Q, W, E, R, QW (a spell picked by a second key, e.g. Hwei), dash, item:&lt;id&gt;, spell:&lt;id&gt;, wait:&lt;seconds&gt;</small>
              <input value={state.combo} onChange={(event) => update({ combo: event.target.value })} />
            </label>
            {report.comboError !== null && <p role="alert" className="note">{report.comboError}</p>}
            <label className="text-field">
              Ability order for time to kill <small className="muted">e.g. Q E W R</small>
              <input value={state.priority} onChange={(event) => update({ priority: event.target.value })} />
            </label>
            {report.priorityError !== null && <p role="alert" className="note">{report.priorityError}</p>}
            <label className="text-field">
              Damage per second over (seconds)
              <input
                type="number" min={0.5} max={MAX_DURATION_SECONDS} step={0.5} value={state.durationSeconds}
                onChange={(event) => {
                  const durationSeconds = Number(event.target.value)
                  if (Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= MAX_DURATION_SECONDS) update({ durationSeconds })
                }}
              />
            </label>
          </details>
        </section>

        <section className="calc-results" aria-label="Results" aria-live="polite">
          <Results report={report} comboText={<code>{state.combo}</code>} />
        </section>
      </div>
    </div>
  )
}
