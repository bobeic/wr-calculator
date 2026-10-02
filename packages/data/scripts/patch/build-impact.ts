import type { Build, Champion, Item } from '@wr-calc/schema'
import { combatantFromChampion, combatantFromDummy, goldEfficiency, simulateCombo, statGoldValues } from '@wr-calc/calc'
import type { ComboAction, StatGoldValues } from '@wr-calc/calc'
import type { PatchDataset } from '../../src/patches/overlay'

/** One damage scenario to run on both patches. */
export interface ImpactScenario {
  label: string
  championId: string
  level: number
  build: Build
  target: { hp: number; armor: number; mr: number; startHpFraction?: number }
  combo: string[]
}

export interface ScenarioImpact {
  label: string
  /** Total damage on each patch; null when the scenario can't run there (the error says why). */
  before: number | null
  after: number | null
  error?: string
}

export interface ItemSide {
  cost: number
  efficiency: number
}

export interface ItemImpact {
  id: string
  name: string
  /** null when the item doesn't exist on that patch. */
  before: ItemSide | null
  after: ItemSide | null
  /** What changed: 'cost', 'stats', 'effects', 'new', 'removed', 'efficiency' (stat prices moved). */
  changes: string[]
}

export interface StatPriceChange {
  stat: string
  before: number | null
  after: number | null
}

export interface BuildImpact {
  from: string
  to: string
  scenarios: ScenarioImpact[]
  items: ItemImpact[]
  /** Items given effects for the first time on the later patch: a modelling change, not a game change. */
  newlyModelled: string[]
  statPrices: StatPriceChange[]
}

export interface PatchSide {
  dataset: PatchDataset
  champions: Map<string, Champion>
}

function runScenario(side: PatchSide, scenario: ImpactScenario): number {
  const champion = side.champions.get(scenario.championId)
  if (!champion) throw new Error(`no champion ${scenario.championId}`)
  const attacker = combatantFromChampion(champion, scenario.level, scenario.build, side.dataset.catalog)
  const target = combatantFromDummy({ kind: 'dummy', ...scenario.target })
  const result = simulateCombo(attacker, target, scenario.combo as ComboAction[], { critMode: 'expected' })
  return Object.values(result.totalsByType).reduce((sum, value) => sum + (value ?? 0), 0)
}

function attempt(fn: () => number): { value: number | null; error?: string } {
  try {
    return { value: fn() }
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) }
  }
}

const EFFICIENCY_EPSILON = 0.0005
const PROSE = new Set(['name', 'description', 'supportNotes'])
/** Effects without their prose, so a reworded description isn't reported as a change. */
const modelled = (effects: Item['effects']): unknown =>
  JSON.parse(JSON.stringify(effects, (key, value: unknown) => (PROSE.has(key) ? undefined : value)))
const sideOf = (item: Item | undefined, prices: StatGoldValues): ItemSide | null =>
  item === undefined ? null : { cost: item.cost.total, efficiency: goldEfficiency(item, prices).efficiency }

/** Compares two patches: every scenario's damage, every item whose price, stats, effects or gold efficiency moved, and stat prices. */
export function buildImpact(from: PatchSide, to: PatchSide, scenarios: ImpactScenario[]): BuildImpact {
  const results = scenarios.map((scenario): ScenarioImpact => {
    const before = attempt(() => runScenario(from, scenario))
    const after = attempt(() => runScenario(to, scenario))
    const error = [before.error && `${from.dataset.id}: ${before.error}`, after.error && `${to.dataset.id}: ${after.error}`].filter(Boolean).join('; ')
    return { label: scenario.label, before: before.value, after: after.value, ...(error ? { error } : {}) }
  })

  const pricesBefore = statGoldValues(from.dataset.items)
  const pricesAfter = statGoldValues(to.dataset.items)
  const beforeById = new Map(from.dataset.items.map((item) => [item.id, item]))
  const afterById = new Map(to.dataset.items.map((item) => [item.id, item]))
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort()
  const newlyModelled: string[] = []
  const items = ids.flatMap((id): ItemImpact[] => {
    const before = beforeById.get(id)
    const after = afterById.get(id)
    const changes: string[] = []
    if (before === undefined) changes.push('new')
    else if (after === undefined) changes.push('removed')
    else {
      // First modelled on the later patch: its effects and hand-written stats are new to us, not to the game.
      const firstModelled = before.effects.length === 0 && after.effects.length > 0
      if (firstModelled) newlyModelled.push(id)
      const afterStats = firstModelled
        ? Object.fromEntries(Object.entries(after.stats).filter(([key]) => key in before.stats))
        : after.stats
      if (before.cost.total !== after.cost.total) changes.push('cost')
      if (JSON.stringify(before.stats) !== JSON.stringify(afterStats)) changes.push('stats')
      if (!firstModelled && JSON.stringify(modelled(before.effects)) !== JSON.stringify(modelled(after.effects))) changes.push('effects')
    }
    const sides = { before: sideOf(before, pricesBefore), after: sideOf(after, pricesAfter) }
    if (changes.length === 0 && sides.before && sides.after && Math.abs(sides.before.efficiency - sides.after.efficiency) > EFFICIENCY_EPSILON) {
      changes.push('efficiency')
    }
    return changes.length === 0 ? [] : [{ id, name: (after ?? before)!.name, ...sides, changes }]
  })

  const stats = [...new Set([...Object.keys(pricesBefore), ...Object.keys(pricesAfter)])].sort()
  const statPrices = stats.flatMap((stat): StatPriceChange[] => {
    const before = pricesBefore[stat as keyof StatGoldValues]?.gold ?? null
    const after = pricesAfter[stat as keyof StatGoldValues]?.gold ?? null
    return before !== null && after !== null && Math.abs(before - after) < 1e-9 ? [] : [{ stat, before, after }]
  })

  return { from: from.dataset.id, to: to.dataset.id, scenarios: results, items, newlyModelled, statPrices }
}

const round = (value: number | null): string => (value === null ? '—' : String(Math.round(value * 10) / 10))
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`

/** Renders BUILD_IMPACT.md: changed scenarios (largest change first), failures, item and stat-price changes. */
export function renderBuildImpact(impact: BuildImpact): string {
  const changed = impact.scenarios
    .filter((entry) => entry.before !== null && entry.after !== null && Math.abs(entry.after - entry.before) >= 0.05)
    .sort((a, b) => Math.abs((b.after! - b.before!) / b.before!) - Math.abs((a.after! - a.before!) / a.before!) || a.label.localeCompare(b.label))
  const failed = impact.scenarios.filter((entry) => entry.error !== undefined)
  const unchanged = impact.scenarios.length - changed.length - failed.length
  const lines = [
    `# Build impact: ${impact.from} → ${impact.to}`, '',
    'Generated by `packages/data/scripts/build-impact.ts`. Every golden-case scenario is run on both patches\' data '
      + '(expected crits); items list stat gold efficiency, which leaves passives out.', '',
    `- ${changed.length} scenarios changed, ${unchanged} unchanged, ${failed.length} can't run on both patches`,
    `- ${impact.items.length} items changed`,
    ...(impact.newlyModelled.length === 0 ? [] : [
      `- ${impact.newlyModelled.length} items modelled for the first time on ${impact.to} (not a game change, not listed below)`,
    ]), '',
    '## Scenarios that changed', '',
    ...(changed.length === 0 ? ['None.'] : [
      `| Scenario | ${impact.from} | ${impact.to} | Change |`, '|---|---:|---:|---:|',
      ...changed.map((entry) => `| ${entry.label} | ${round(entry.before)} | ${round(entry.after)} | ${entry.after! >= entry.before! ? '+' : ''}${pct((entry.after! - entry.before!) / entry.before!)} |`),
    ]), '',
    ...(failed.length === 0 ? [] : ['## Scenarios that can\'t run on both patches', '', ...failed.map((entry) => `- ${entry.label}: ${entry.error}`), '']),
    '## Items', '',
    ...(impact.items.length === 0 ? ['None.'] : [
      `| Item | What changed | Cost | Gold efficiency |`, '|---|---|---:|---:|',
      ...impact.items.map((entry) => {
        const cost = entry.before?.cost === entry.after?.cost ? String(entry.after?.cost ?? '—') : `${entry.before?.cost ?? '—'} → ${entry.after?.cost ?? '—'}`
        const eff = (side: ItemSide | null) => (side === null ? '—' : pct(side.efficiency))
        const efficiency = entry.before && entry.after && Math.abs(entry.before.efficiency - entry.after.efficiency) <= EFFICIENCY_EPSILON
          ? eff(entry.after) : `${eff(entry.before)} → ${eff(entry.after)}`
        return `| ${entry.name} (\`${entry.id}\`) | ${entry.changes.join(', ')} | ${cost} | ${efficiency} |`
      }),
    ]), '',
    '## Stat gold values', '',
    ...(impact.statPrices.length === 0 ? ['Unchanged.'] : impact.statPrices.map((entry) => `- ${entry.stat}: ${round(entry.before)} → ${round(entry.after)} gold per unit`)),
  ]
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}
