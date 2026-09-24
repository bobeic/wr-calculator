'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import { PATCH_7_3_DATASET } from '../lib/dataset'
import { CRIT_MODES, MAX_DURATION_SECONDS } from '../lib/debug-state'
import type { DebugState } from '../lib/debug-state'
import { decodeState, encodeState } from '../lib/url-state'
import { findMissingComboItems, parseCombo, parsePriority } from '../lib/parse-combo'
import { runDebug } from '../lib/run-debug'
import { BuildEditor } from './build-editor'
import { TargetEditor } from './target-editor'
import { ComboPanel, ComparePanel, NullsPanel, StatSheetsPanel, WarningsPanel } from './result-panels'

const dataset = PATCH_7_3_DATASET

/** The debug page: state is decoded from the URL once, mirrored back on every change, and re-run through the engine. */
export function DebugPage() {
  const searchParams = useSearchParams()
  const [initial] = useState(() => decodeState(searchParams, dataset))
  const [state, setState] = useState<DebugState>(initial.state)

  // Native replaceState, not router.replace: Next keys the page segment by its search params, so a
  // router navigation remounts DebugPage and re-decodes the already-cleaned URL, losing `initial.issues`.
  useEffect(() => {
    window.history.replaceState(null, '', `?${encodeState(state)}`)
  }, [state])

  const result = useMemo(() => runDebug(state, dataset), [state])
  const comboParse = parseCombo(state.combo)
  const priorityParse = parsePriority(state.priority)
  const missingComboItems = findMissingComboItems(
    comboParse.ok ? comboParse.actions : [], state.buildA, state.buildB,
  )
  const update = (patch: Partial<DebugState>) => setState((current) => ({ ...current, ...patch }))

  return (
    <main>
      <h1>wr-calc debug (patch 7.3)</h1>
      <p>
        Ability damage and cooldowns resolved from per-rank data currently collapse to 0 (see{' '}
        docs/decisions/2026-09-24-byrank-scalar-ability-rank-context.md), so combo and compareBuilds
        ability numbers are not trustworthy yet.
      </p>
      <NullsPanel nulls={result.nulls} />
      {initial.issues.length > 0 && (
        <section>
          <h2>URL issues (on load)</h2>
          <ul>
            {initial.issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}
          </ul>
        </section>
      )}
      <section>
        <h2>Inputs</h2>
        <label>
          Champion{' '}
          <select value={state.championId} onChange={(event) => update({ championId: event.target.value })}>
            {[...dataset.champions.values()].map((champion) => (
              <option key={champion.id} value={champion.id}>{champion.name}</option>
            ))}
          </select>
        </label>{' '}
        <label>
          Level{' '}
          <input type="number" min={1} max={MAX_CHAMPION_LEVEL} value={state.level} onChange={(event) => {
            const level = Number(event.target.value)
            if (Number.isInteger(level) && level >= 1 && level <= MAX_CHAMPION_LEVEL) update({ level })
          }} />
        </label>
        <BuildEditor label="Build A" build={state.buildA} catalog={dataset.catalog} onChange={(buildA) => update({ buildA })} />
        <BuildEditor label="Build B" build={state.buildB} catalog={dataset.catalog} onChange={(buildB) => update({ buildB })} />
        <TargetEditor target={state.target} dataset={dataset} onChange={(target) => update({ target })} />
        <p>
          <label>Combo <input value={state.combo} onChange={(event) => update({ combo: event.target.value })} /></label>
          {!comboParse.ok && <span role="alert"> {comboParse.error}</span>}
          {missingComboItems.length > 0 && (
            <ul>
              {missingComboItems.map((warning, index) => (
                <li key={`${index}-${warning}`} role="alert">{warning}</li>
              ))}
            </ul>
          )}
        </p>
        <p>
          <label>Priority <input value={state.priority} onChange={(event) => update({ priority: event.target.value })} /></label>
          {!priorityParse.ok && <span role="alert"> {priorityParse.error}</span>}
        </p>
        <p>
          <label>
            Duration (s, max {MAX_DURATION_SECONDS}){' '}
            <input
              type="number" min={0.5} max={MAX_DURATION_SECONDS} step={0.5} value={state.durationSeconds}
              onChange={(event) => {
                const durationSeconds = Number(event.target.value)
                if (
                  Number.isFinite(durationSeconds) && durationSeconds > 0
                  && durationSeconds <= MAX_DURATION_SECONDS
                ) update({ durationSeconds })
              }}
            />
          </label>{' '}
          <label>
            Crit mode{' '}
            <select value={state.critMode} onChange={(event) => {
              const critMode = CRIT_MODES.find((mode) => mode === event.target.value)
              if (critMode) update({ critMode })
            }}>
              {CRIT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>{' '}
            <small>(combo panel only; compareBuilds uses expected crits)</small>
          </label>
        </p>
      </section>
      <StatSheetsPanel a={result.sheetA} b={result.sheetB} />
      <ComboPanel a={result.comboA} b={result.comboB} />
      <ComparePanel compare={result.compare} />
      <WarningsPanel envelope={result.envelope} />
    </main>
  )
}
