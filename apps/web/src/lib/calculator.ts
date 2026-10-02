import type { AbilityVariant, Champion, StatKey } from '@wr-calc/schema'
import type {
  AbilityKey, BuildIssue, ComboAction, ComboResult, Combatant, UnsupportedEffectEntry,
} from '@wr-calc/calc'
import { combatantFromChampion, simulateCombo, sustainedDps } from '@wr-calc/calc'
import type { DebugBuild, DebugDataset, DebugState } from './debug-state'
import { parseCombo, parsePriority } from './parse-combo'
import { targetCombatant, toBuild } from './run-debug'
import { summarizeBuild } from './build-summary'

/** How long the per-ability rows wait after a cast so burns and bleeds finish ticking. */
const SETTLE_SECONDS = 6
/** The longest rotation the time-to-kill search simulates. */
export const MAX_TTK_SECONDS = 60

/** 'aa', an ability key, or an ability key and a variant key ('q:w' is Hwei's Severing Bolt). */
export type RowKey = 'aa' | AbilityKey | `${AbilityKey}:${AbilityVariant['key']}`

export interface SourceDamage {
  name: string
  damage: number
}

/** One row of the per-ability table: what a basic attack or one cast does to the target. */
export interface AbilityRow {
  key: RowKey
  /** How a combo writes it: 'AA', 'Q' or 'QW'. */
  label: string
  name: string
  /**
   * 'hit': damage from the cast itself (every stage, plus the procs and burns it sets off). 'empowers': the cast deals
   * nothing itself, so the value is how much more the next basic attack deals. 'none': neither.
   */
  kind: 'hit' | 'empowers' | 'none'
  damage: number
  sources: SourceDamage[]
}

export const SHOWN_STATS: readonly StatKey[] = [
  'hp', 'ad', 'ap', 'armor', 'mr', 'attackSpeed', 'critChance', 'abilityHaste', 'pctArmorPen', 'flatArmorPen',
  'pctMagicPen', 'flatMagicPen',
]

export interface BuildReport {
  cost: number
  issues: BuildIssue[]
  stats: Partial<Record<StatKey, number>>
  rows: AbilityRow[]
  /** The combo text run once, cooldowns respected. Null when the combo text doesn't parse. */
  combo: { damage: number; killed: boolean; timeToKill?: number } | null
  /** Abilities in priority order off cooldown, basic attacks between: seconds to kill (undefined: not within the limit). */
  timeToKill?: number
  /** Damage per second over the state's duration, same rotation. */
  dps: number
  unmodelled: UnsupportedEffectEntry[]
  dataWarnings: string[]
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string }

export interface TargetReport {
  name: string
  hp: number
  armor: number
  mr: number
}

export interface CalculatorReport {
  target: Outcome<TargetReport>
  a: Outcome<BuildReport>
  /** Null unless the page compares two builds. */
  b: Outcome<BuildReport> | null
  comboError: string | null
  priorityError: string | null
}

const ABILITY_ACTIONS: Record<AbilityKey, ComboAction> = { q: 'Q', w: 'W', e: 'E', r: 'R' }

function total(result: ComboResult): number {
  return result.instances.reduce((sum, instance) => sum + instance.mitigated, 0)
}

/** Damage per source in the order the sources first hit; a merged hit is split by its parts' raw shares. */
function bySource(result: ComboResult): SourceDamage[] {
  const totals = new Map<string, SourceDamage>()
  for (const instance of result.instances) {
    const parts = instance.parts && instance.parts.length > 1
      ? instance.parts.map((part) => ({ name: part.source.name, share: part.amount / (instance.raw || 1) }))
      : [{ name: instance.source.name, share: 1 }]
    for (const part of parts) {
      const entry = totals.get(part.name) ?? { name: part.name, damage: 0 }
      entry.damage += instance.mitigated * part.share
      totals.set(part.name, entry)
    }
  }
  return [...totals.values()]
}

/** The action that casts an ability, or one of its variants. */
function castAction(key: AbilityKey, variant?: AbilityVariant['key']): ComboAction {
  return variant === undefined ? ABILITY_ACTIONS[key] : `${ABILITY_ACTIONS[key] as 'Q' | 'W' | 'E' | 'R'}:${variant}`
}

/** The actions that cast an ability (or one variant) and every follow-up stage (a press or a dash), then wait for its burns. */
export function castActions(champion: Champion, key: AbilityKey, variant?: AbilityVariant['key']): ComboAction[] {
  const stages = champion.abilities[key].stages ?? []
  return [
    castAction(key, variant),
    ...stages.map((stage): ComboAction => (stage.trigger === 'press' ? ABILITY_ACTIONS[key] : 'dash')),
    `wait:${SETTLE_SECONDS}`,
  ]
}

/**
 * The basic attack row and one row per ability (one per spell for an ability with variants), each simulated alone
 * against a fresh target.
 */
export function abilityRows(champion: Champion, attacker: Combatant, target: Combatant): AbilityRow[] {
  const simulate = (actions: ComboAction[]) => simulateCombo(attacker, target, actions, { critMode: 'expected', ignoreCooldowns: true })
  const attack = simulate(['AA', `wait:${SETTLE_SECONDS}`])
  const rows: AbilityRow[] = [{ key: 'aa', label: 'AA', name: 'Basic attack', kind: 'hit', damage: total(attack), sources: bySource(attack) }]
  for (const key of ['q', 'w', 'e', 'r'] as const) {
    const ability = champion.abilities[key]
    const casts = ability.variants === undefined
      ? [{ rowKey: key as RowKey, label: ABILITY_ACTIONS[key], name: ability.name, variant: undefined }]
      : ability.variants.map((variant) => ({
        rowKey: `${key}:${variant.key}` as RowKey, label: `${ABILITY_ACTIONS[key]}${variant.key.toUpperCase()}`,
        name: variant.name, variant: variant.key,
      }))
    for (const { rowKey, label, name, variant } of casts) {
      const cast = simulate(castActions(champion, key, variant))
      if (total(cast) > 0) {
        rows.push({ key: rowKey, label, name, kind: 'hit', damage: total(cast), sources: bySource(cast) })
        continue
      }
      const empowered = simulate([castAction(key, variant), 'AA', `wait:${SETTLE_SECONDS}`])
      const extra = total(empowered) - total(attack)
      rows.push(extra > 0.05
        ? { key: rowKey, label, name, kind: 'empowers', damage: extra, sources: bySource(empowered) }
        : { key: rowKey, label, name, kind: 'none', damage: 0, sources: [] })
    }
  }
  return rows
}

/** Abilities in `priority` order whenever they're off cooldown, a basic attack after each pass, for `seconds`. */
export function rotation(priority: AbilityKey[], attackSpeed: number, seconds: number): ComboAction[] {
  const passes = Math.ceil(seconds * Math.max(attackSpeed, 0.01)) + priority.length + 1
  return Array.from({ length: passes }, () => [...priority.map((key) => ABILITY_ACTIONS[key]), 'AA' as const]).flat()
}

function attempt<T>(fn: () => T): Outcome<T> {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function buildReport(
  build: DebugBuild, state: DebugState, champion: Champion, target: Combatant, dataset: DebugDataset,
  combo: ComboAction[] | null, priority: AbilityKey[],
): BuildReport {
  const attacker = combatantFromChampion(champion, state.level, toBuild(build, dataset, state.abilityRanks, champion), dataset.catalog)
  const summary = summarizeBuild(build, dataset.catalog)
  const comboResult = combo === null ? null : simulateCombo(attacker, target, combo, { critMode: state.critMode })
  const long = simulateCombo(
    attacker, target, rotation(priority, attacker.sheet.total.attackSpeed ?? 1, MAX_TTK_SECONDS), { critMode: 'expected' },
  )
  const unmodelled = new Map<string, UnsupportedEffectEntry>()
  for (const entry of [...attacker.sheet.unsupportedEffects, ...(comboResult?.unsupportedEffects ?? []), ...long.unsupportedEffects]) {
    unmodelled.set(entry.id, entry)
  }
  return {
    cost: summary.totalCost,
    issues: summary.issues,
    stats: Object.fromEntries(SHOWN_STATS.map((stat) => [stat, attacker.sheet.total[stat] ?? 0])),
    rows: abilityRows(champion, attacker, target),
    combo: comboResult === null ? null : {
      damage: total(comboResult), killed: comboResult.killed,
      ...(comboResult.timeToKill !== undefined && { timeToKill: comboResult.timeToKill }),
    },
    ...(long.killed && long.timeToKill !== undefined && long.timeToKill <= MAX_TTK_SECONDS && { timeToKill: long.timeToKill }),
    dps: sustainedDps(attacker, target, state.durationSeconds, priority),
    unmodelled: [...unmodelled.values()],
    dataWarnings: [...new Set([...attacker.sheet.dataWarnings, ...(comboResult?.dataWarnings ?? [])])],
  }
}

function targetName(state: DebugState, dataset: DebugDataset): string {
  const target = state.target
  switch (target.kind) {
    case 'preset':
      return dataset.targets.find((preset) => preset.id === target.presetId)?.name ?? target.presetId
    case 'dummy':
      return 'Custom dummy'
    case 'champion':
      return `${dataset.champions.get(target.championId)?.name ?? target.championId}, level ${target.level}`
  }
}

/** Ability text often comes in capitals ('CUNNING SWEEP'); shows it as 'Cunning Sweep'. Mixed-case names are kept. */
export function displayName(name: string): string {
  if (name !== name.toUpperCase()) return name
  return name.toLowerCase().replace(/(^|[\s(:-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
}

/** True when a build has nothing in it. */
export function isEmptyBuild(build: DebugBuild): boolean {
  return build.items.length === 0 && build.boots === undefined && build.runes.length === 0 && (build.spells ?? []).length === 0
}

/** Everything the calculator page shows, each part failing on its own. */
export function runCalculator(state: DebugState, dataset: DebugDataset, compare: boolean): CalculatorReport {
  const comboParse = parseCombo(state.combo)
  const priorityParse = parsePriority(state.priority)
  const combo = comboParse.ok ? comboParse.actions : null
  const priority = priorityParse.ok && priorityParse.keys.length > 0 ? priorityParse.keys : (['q', 'w', 'e', 'r'] as AbilityKey[])
  const champion = dataset.champions.get(state.championId)
  const target = attempt(() => targetCombatant(state.target, dataset))

  const side = (build: DebugBuild): Outcome<BuildReport> => {
    if (champion === undefined) return { ok: false, error: `unknown champion '${state.championId}'` }
    if (!target.ok) return { ok: false, error: `target: ${target.error}` }
    return attempt(() => buildReport(build, state, champion, target.value, dataset, combo, priority))
  }

  return {
    target: target.ok
      ? {
        ok: true,
        value: {
          name: targetName(state, dataset), hp: target.value.sheet.total.hp ?? 0,
          armor: target.value.sheet.total.armor ?? 0, mr: target.value.sheet.total.mr ?? 0,
        },
      }
      : target,
    a: side(state.buildA),
    b: compare ? side(state.buildB) : null,
    comboError: comboParse.ok ? null : comboParse.error,
    priorityError: priorityParse.ok ? null : priorityParse.error,
  }
}
