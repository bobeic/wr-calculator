import type { ReactNode } from 'react'
import { STAT_KEYS } from '@wr-calc/schema'
import type { BuildBreakpoint, ComboResult, CompareBuildsResult, StatSheet } from '@wr-calc/calc'
import type { DebugEnvelope, Stage } from '../lib/run-debug'
import type { NullEntry } from '../lib/null-report'
import { sourceLabel } from '../lib/source-label'

function fmt(value: number | undefined): string {
  return value === undefined ? '—' : value.toFixed(1)
}

function StageView<T>({ stage, children }: { stage: Stage<T>; children: (value: T) => ReactNode }) {
  return stage.ok ? <>{children(stage.value)}</> : <p role="alert">Error: {stage.error}</p>
}

function SideBySide({ a, b }: { a: ReactNode; b: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      <div><h3>Build A</h3>{a}</div>
      <div><h3>Build B</h3>{b}</div>
    </div>
  )
}

/** Lists every null value in the current selection: the data still to enter. */
export function NullsPanel({ nulls }: { nulls: NullEntry[] }) {
  return (
    <details open>
      <summary>Data still to enter ({nulls.length})</summary>
      <ul>{nulls.map((entry) => <li key={entry.path}>{entry.path}</li>)}</ul>
    </details>
  )
}

function StatSheetTable({ sheet }: { sheet: StatSheet }) {
  const stats = STAT_KEYS.filter((stat) => sheet.total[stat] !== undefined)
  return (
    <table>
      <thead><tr><th>Stat</th><th>Total</th><th>Base</th><th>Bonus</th><th>Breakdown</th></tr></thead>
      <tbody>
        {stats.map((stat) => {
          const contributions = sheet.breakdown.filter((contribution) => contribution.stat === stat)
          return (
            <tr key={stat}>
              <td>{stat}</td>
              <td>{fmt(sheet.total[stat])}</td>
              <td>{fmt(sheet.base[stat])}</td>
              <td>{fmt(sheet.bonus[stat])}</td>
              <td>
                <details>
                  <summary>{contributions.length} contributions</summary>
                  <ul>
                    {contributions.map((contribution, index) => (
                      <li key={index}>
                        {contribution.source.kind} {contribution.source.name} ({contribution.layer}):{' '}
                        {fmt(contribution.amount)}
                        {contribution.dataWarning ? ` ⚠ ${contribution.dataWarning}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Both builds' resolved stat sheets, with a per-stat breakdown. */
export function StatSheetsPanel({ a, b }: { a: Stage<StatSheet>; b: Stage<StatSheet> }) {
  return (
    <section>
      <h2>Stat sheets</h2>
      <SideBySide
        a={<StageView stage={a}>{(sheet) => <StatSheetTable sheet={sheet} />}</StageView>}
        b={<StageView stage={b}>{(sheet) => <StatSheetTable sheet={sheet} />}</StageView>}
      />
    </section>
  )
}

function ComboView({ result }: { result: ComboResult }) {
  return (
    <>
      <p>
        Killed: {result.killed ? 'yes' : 'no'} · TTK: {fmt(result.timeToKill)} · Overkill:{' '}
        {fmt(result.overkill)}
      </p>
      <h4>Totals by type</h4>
      <ul>
        {Object.entries(result.totalsByType).map(([type, total]) => <li key={type}>{type}: {fmt(total)}</li>)}
      </ul>
      <h4>Totals by source</h4>
      <ul>
        {Object.entries(result.totalsBySource).map(([source, total]) => (
          <li key={source}>{source}: {fmt(total)}</li>
        ))}
      </ul>
      <h4>Instance log</h4>
      <table>
        <thead>
          <tr><th>Time</th><th>Source</th><th>Type</th><th>Raw</th><th>Mitigated</th><th>Target HP after</th></tr>
        </thead>
        <tbody>
          {result.instances.map((instance, index) => (
            <tr key={index}>
              <td>{instance.time.toFixed(2)}</td>
              <td>{sourceLabel(instance, fmt)}</td>
              <td>{instance.type}</td>
              <td>{fmt(instance.raw)}</td>
              <td>{fmt(instance.mitigated)}</td>
              <td>{fmt(instance.targetHpAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/** Both builds' combo results: totals, kill info, and the damage instance log. */
export function ComboPanel({ a, b }: { a: Stage<ComboResult>; b: Stage<ComboResult> }) {
  return (
    <section>
      <h2>Combo</h2>
      <SideBySide
        a={<StageView stage={a}>{(result) => <ComboView result={result} />}</StageView>}
        b={<StageView stage={b}>{(result) => <ComboView result={result} />}</StageView>}
      />
    </section>
  )
}

function BreakpointTable({ rows }: { rows: BuildBreakpoint[] }) {
  if (rows.length === 0) return <p>No breakpoints (a build with no items produces none).</p>
  return (
    <table>
      <thead>
        <tr><th>Gold</th><th>Burst</th><th>DPS</th><th>TTK</th><th>EHP phys</th><th>EHP magic</th></tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <td>{row.gold}</td>
            <td>{fmt(row.burst)}</td>
            <td>{fmt(row.dps)}</td>
            <td>{fmt(row.ttk)}</td>
            <td>{fmt(row.ehp.physical)}</td>
            <td>{fmt(row.ehp.magic)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The compareBuilds breakpoint table for both builds. */
export function ComparePanel({ compare }: { compare: Stage<CompareBuildsResult> }) {
  return (
    <section>
      <h2>compareBuilds</h2>
      <StageView stage={compare}>
        {(result) => <SideBySide a={<BreakpointTable rows={result.a} />} b={<BreakpointTable rows={result.b} />} />}
      </StageView>
    </section>
  )
}

/** Unsupported/partial effects, data warnings and unverified rules from every engine call. */
export function WarningsPanel({ envelope }: { envelope: DebugEnvelope }) {
  return (
    <section>
      <h2>Warnings</h2>
      <h3>Unsupported / partial effects ({envelope.unsupportedEffects.length})</h3>
      <ul>
        {envelope.unsupportedEffects.map((entry) => (
          <li key={entry.id}>
            {entry.id} ({entry.support}){entry.supportNotes ? `: ${entry.supportNotes}` : ''}
          </li>
        ))}
      </ul>
      <h3>Data warnings ({envelope.dataWarnings.length})</h3>
      <ul>{envelope.dataWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      <h3>Unverified rules ({envelope.unverifiedRules.length})</h3>
      <ul>{envelope.unverifiedRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
    </section>
  )
}
