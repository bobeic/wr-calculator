import type { ReactNode } from 'react'
import type { StatKey } from '@wr-calc/schema'
import type { AbilityRow, BuildReport, CalculatorReport, Outcome } from '../../lib/calculator'
import { MAX_TTK_SECONDS, SHOWN_STATS, displayName } from '../../lib/calculator'

const STAT_LABELS: Record<string, string> = {
  hp: 'Health', ad: 'Attack damage', ap: 'Ability power', armor: 'Armor', mr: 'Magic resist',
  attackSpeed: 'Attack speed', critChance: 'Crit chance', abilityHaste: 'Ability haste',
  pctArmorPen: 'Armor pen %', flatArmorPen: 'Armor pen', pctMagicPen: 'Magic pen %', flatMagicPen: 'Magic pen',
}
const PERCENT_STATS: ReadonlySet<StatKey> = new Set(['critChance', 'pctArmorPen', 'pctMagicPen'])

const whole = (value: number) => Math.round(value).toLocaleString('en')
const seconds = (value: number | undefined) => (value === undefined ? `over ${MAX_TTK_SECONDS}s` : `${value.toFixed(1)}s`)

function statValue(stat: StatKey, value: number): string {
  if (PERCENT_STATS.has(stat)) return `${Math.round(value * 100)}%`
  if (stat === 'attackSpeed') return value.toFixed(2)
  return whole(value)
}

/** B minus A, coloured by whether it's better (`higherIsBetter` says which way that is). */
function Delta({ a, b, higherIsBetter = true, format = whole }: {
  a: number | undefined; b: number | undefined; higherIsBetter?: boolean; format?: (value: number) => string
}) {
  if (a === undefined || b === undefined || Math.abs(b - a) < 0.5) return <span className="muted">—</span>
  const better = (b > a) === higherIsBetter
  return <span className={better ? 'better' : 'worse'}>{b > a ? '+' : '−'}{format(Math.abs(b - a))}</span>
}

function Sources({ row, hp }: { row: AbilityRow; hp: number }) {
  if (row.kind === 'none') return <span className="muted">no damage</span>
  return (
    <>
      <span className="big">{whole(row.damage)}</span>
      <span className="muted"> {hp > 0 ? `${Math.round((row.damage / hp) * 100)}%` : ''}</span>
      {row.kind === 'empowers' && <span className="muted"> next attack</span>}
      {row.sources.length > 1 && (
        <span className="sources">{row.sources.map((source) => `${displayName(source.name)} ${whole(source.damage)}`).join(' · ')}</span>
      )}
    </>
  )
}

function failed(outcome: Outcome<BuildReport> | null): string | null {
  return outcome !== null && !outcome.ok ? outcome.error : null
}

interface ResultsProps {
  report: CalculatorReport
  comboText: ReactNode
}

/** The numbers: headline time-to-kill, a per-ability table and stats, one column per build. */
export function Results({ report, comboText }: ResultsProps) {
  const a = report.a.ok ? report.a.value : undefined
  const b = report.b?.ok ? report.b.value : undefined
  const comparing = report.b !== null
  const hp = report.target.ok ? report.target.value.hp : 0
  const errors = [failed(report.a), failed(report.b)].filter((error): error is string => error !== null)
  const columns = comparing ? ['Build A', 'Build B', 'B − A'] : ['Build A']
  const cards: Array<{ label: string; value: BuildReport | undefined }> = comparing
    ? [{ label: 'Build A: time to kill', value: a }, { label: 'Build B: time to kill', value: b }]
    : [{ label: 'Time to kill', value: a }]

  return (
    <div className="results">
      {report.target.ok
        ? (
          <p className="target-line">
            Against <strong>{report.target.value.name}</strong>: {whole(report.target.value.hp)} HP,{' '}
            {whole(report.target.value.armor)} armor, {whole(report.target.value.mr)} MR
          </p>
        )
        : <p role="alert">Target: {report.target.error}</p>}
      {errors.map((error) => <p key={error} role="alert">Could not calculate: {error}</p>)}

      <div className="headline">
        {cards.map((card) => (
          <div key={card.label} className="headline-card">
            <span className="muted">{card.label}</span>
            <span className="big">{card.value === undefined ? '—' : seconds(card.value.timeToKill)}</span>
            {card.value !== undefined && <span className="muted">{whole(card.value.dps)} damage per second</span>}
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Damage to target</th>{columns.map((column) => <th key={column} className="num">{column}</th>)}</tr>
          </thead>
          <tbody>
            {(a ?? b)?.rows.map((row, index) => (
              <tr key={row.key}>
                <td><span className="key">{row.label}</span> {displayName(row.name)}</td>
                <td className="num">{a ? <Sources row={a.rows[index]} hp={hp} /> : '—'}</td>
                {comparing && <td className="num">{b ? <Sources row={b.rows[index]} hp={hp} /> : '—'}</td>}
                {comparing && <td className="num"><Delta a={a?.rows[index].damage} b={b?.rows[index].damage} /></td>}
              </tr>
            ))}
            <tr className="combo-row">
              <td>Combo: {comboText}</td>
              {[a, ...(comparing ? [b] : [])].map((value, index) => (
                <td key={index} className="num">
                  {value?.combo == null ? '—' : (
                    <>
                      <span className="big">{whole(value.combo.damage)}</span>
                      <span className="muted"> {hp > 0 ? `${Math.round((value.combo.damage / hp) * 100)}%` : ''}</span>
                      {value.combo.killed && <span className="better"> kills at {value.combo.timeToKill?.toFixed(1)}s</span>}
                    </>
                  )}
                </td>
              ))}
              {comparing && <td className="num"><Delta a={a?.combo?.damage} b={b?.combo?.damage} /></td>}
            </tr>
            <tr>
              <td>Time to kill (abilities on cooldown, attacks between)</td>
              <td className="num">{a ? seconds(a.timeToKill) : '—'}</td>
              {comparing && <td className="num">{b ? seconds(b.timeToKill) : '—'}</td>}
              {comparing && (
                <td className="num">
                  <Delta a={a?.timeToKill} b={b?.timeToKill} higherIsBetter={false} format={(value) => `${value.toFixed(1)}s`} />
                </td>
              )}
            </tr>
            <tr>
              <td>Gold</td>
              <td className="num">{a ? whole(a.cost) : '—'}</td>
              {comparing && <td className="num">{b ? whole(b.cost) : '—'}</td>}
              {comparing && <td className="num"><Delta a={a?.cost} b={b?.cost} higherIsBetter={false} /></td>}
            </tr>
          </tbody>
        </table>
      </div>

      <details className="stats-details">
        <summary>Stats</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Stat</th>{columns.map((column) => <th key={column} className="num">{column}</th>)}</tr></thead>
            <tbody>
              {SHOWN_STATS.map((stat) => (
                <tr key={stat}>
                  <td>{STAT_LABELS[stat] ?? stat}</td>
                  <td className="num">{a ? statValue(stat, a.stats[stat] ?? 0) : '—'}</td>
                  {comparing && <td className="num">{b ? statValue(stat, b.stats[stat] ?? 0) : '—'}</td>}
                  {comparing && (
                    <td className="num">
                      <Delta a={a?.stats[stat]} b={b?.stats[stat]} format={(value) => statValue(stat, value)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <Unmodelled reports={[a, b].filter((value): value is BuildReport => value !== undefined)} />
    </div>
  )
}

function Unmodelled({ reports }: { reports: BuildReport[] }) {
  const entries = new Map(reports.flatMap((report) => report.unmodelled).map((entry) => [entry.id, entry]))
  const warnings = [...new Set(reports.flatMap((report) => report.dataWarnings))]
  if (entries.size === 0 && warnings.length === 0) return null
  return (
    <details className="unmodelled">
      <summary>Not fully modelled ({entries.size + warnings.length})</summary>
      <ul>
        {[...entries.values()].map((entry) => (
          <li key={entry.id}>
            <code>{entry.id}</code>{entry.support === 'none' ? ' (not modelled)' : ' (partly)'}{entry.supportNotes ? `: ${entry.supportNotes}` : ''}
          </li>
        ))}
        {warnings.map((warning) => <li key={warning}>{warning}</li>)}
      </ul>
    </details>
  )
}
