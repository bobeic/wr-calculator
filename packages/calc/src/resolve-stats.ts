import type { Champion, Build, Item, Rune, SummonerSpell, Effect, StatKey, NullableScalar, Condition } from '@wr-calc/schema'
import { STAT_KEYS } from '@wr-calc/schema'
import {
  MAX_CHAMPION_LEVEL, ATTACK_SPEED_CAP, STAT_RESOLUTION_ORDER, statAtLevel, attackSpeedAtLevel,
  totalAttackSpeed,
} from './rules'
import type { UnverifiedRuleId } from './rules'
import { resolveScalar, scalarWarning } from './resolve-scalar'
import { championKitEffects } from './kit-effects'
import { contributeStats, stageOf } from './effects/registry'
import type { StatContribution, StatContext, StatLayer, StatSource } from './effects/types'
import type { UnsupportedEffectEntry } from './result-envelope'
import { validateBuild } from './validate-build'

export interface StatSheet {
  base: Partial<Record<StatKey, number>>
  bonus: Partial<Record<StatKey, number>>
  total: Partial<Record<StatKey, number>>
  breakdown: StatContribution[]
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
  /**
   * Stat contributions from effects whose condition is only known in combat (e.g. targetHasDot).
   * They are sized here, at their stage, but applied by the combat simulation while it holds.
   */
  combatContributions?: CombatContribution[]
}

export interface CombatContribution {
  effect: Effect
  contributions: StatContribution[]
}

/** Whether a condition can only be evaluated during combat, not at stat resolution. */
export function isCombatOnlyCondition(condition: Condition | undefined): boolean {
  if (!condition) return false
  if (condition.type === 'allOf') return condition.conditions.some((leaf) => leaf.type === 'targetHasDot')
  return condition.type === 'targetHasDot'
}

/**
 * Whether a stat effect's condition holds when stats are resolved. Only toggles can be read here; every other
 * condition is unknown until combat and counts as met (combat-only ones are deferred, see isCombatOnlyCondition).
 */
function statTimeConditionMet(condition: Condition | undefined, inputs: Record<string, number | boolean>): boolean {
  if (!condition) return true
  if (condition.type === 'toggle') return inputs[condition.inputId] === true
  if (condition.type === 'allOf') return condition.conditions.every((leaf) => statTimeConditionMet(leaf, inputs))
  return true
}

export interface StatCatalog {
  items: Map<string, Item>
  runes: Map<string, Rune>
  /** Summoner spells; optional so catalogs built before spells existed still work. */
  spells?: Map<string, SummonerSpell>
}

/** Resolves a champion's base/bonus/total stats for a level and build, with a full breakdown. */
export function resolveStats(
  champion: Champion, level: number, build: Build, catalog: StatCatalog
): StatSheet {
  const clampedLevel = Math.min(Math.max(Math.round(level), 1), MAX_CHAMPION_LEVEL)

  const base: Partial<Record<StatKey, number>> = {}
  const bonus: Partial<Record<StatKey, number>> = {}
  const breakdown: StatContribution[] = []
  const dataWarnings: string[] = []
  const unsupportedEffects: UnsupportedEffectEntry[] = []
  const unverifiedRules = new Set<UnverifiedRuleId>([
    'maxChampionLevel', 'statResolutionOrder', 'attackSpeedRatioGrowth',
    'attackSpeedCap', 'attackSpeedStacking',
  ])

  const record = (contribution: StatContribution) => {
    if (contribution.layer === 'base') {
      base[contribution.stat] = (base[contribution.stat] ?? 0) + contribution.amount
    } else {
      bonus[contribution.stat] = (bonus[contribution.stat] ?? 0) + contribution.amount
    }
    breakdown.push(contribution)
    if (contribution.dataWarning) dataWarnings.push(contribution.dataWarning)
    if (contribution.usedLevelRangeInterpolation) unverifiedRules.add('levelRangeInterpolation')
  }

  const championSource: StatSource = { kind: 'champion', id: champion.id, name: champion.name }

  for (
    const [stat, growth] of
      Object.entries(champion.baseStats) as [StatKey, { base: number; perLevel: number }][]
  ) {
    record({
      stat, layer: 'base', amount: statAtLevel(growth.base, growth.perLevel, clampedLevel),
      source: championSource, usedLevelRangeInterpolation: false,
    })
  }
  record({
    stat: 'attackSpeed', layer: 'base',
    amount: attackSpeedAtLevel(
      champion.attackSpeed.base, champion.attackSpeed.ratio ?? 0, clampedLevel
    ),
    source: championSource, usedLevelRangeInterpolation: false,
  })

  // While the multiplier stage runs, every multiplier reads the stats as they were before that
  // stage, so % bonuses on one stat add together rather than compound (verified in game
  // 2026-09-26: Rabadon's +30% and Blackfire's +4% gave 450 AP x 1.34).
  let frozen: { base: typeof base; bonus: typeof bonus } | undefined
  const statSoFar = (stat: StatKey, layer: StatLayer | 'total'): number => {
    const source = frozen ?? { base, bonus }
    if (layer === 'base') return source.base[stat] ?? 0
    if (layer === 'bonus') return source.bonus[stat] ?? 0
    return (source.base[stat] ?? 0) + (source.bonus[stat] ?? 0)
  }

  const itemIds = [
    ...build.items,
    ...(build.boots ? [build.boots] : []),
    ...(build.enchant ? [build.enchant] : []),
  ]
  const issues = validateBuild(build, catalog.items, catalog.runes)
  if (issues.length > 0) throw new Error(`resolveStats: ${issues.map((issue) => issue.message).join('; ')}`)
  const items = itemIds.map((id) => catalog.items.get(id) as Item)
  const runes = build.runes.map((id) => {
    const rune = catalog.runes.get(id)
    if (!rune) throw new Error(`resolveStats: unknown rune id '${id}' in build`)
    return rune
  })

  for (const item of items) {
    const source: StatSource = { kind: 'item', id: item.id, name: item.name }
    for (const [stat, scalar] of Object.entries(item.stats) as [StatKey, NullableScalar][]) {
      const resolved = resolveScalar(scalar, clampedLevel)
      record({
        stat, layer: 'bonus', amount: resolved.value, source,
        dataWarning: scalarWarning(item.name, `stats.${stat}`, resolved),
        usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
      })
    }
  }

  const effects: Effect[] = [
    ...championKitEffects(champion, build.abilityRanks),
    ...items.flatMap((item) => item.effects),
    ...runes.flatMap((rune) => rune.effects),
  ]
  const ctx: StatContext = { level: clampedLevel, inputs: build.inputs, statSoFar }
  const combatContributions: CombatContribution[] = []
  for (const stage of STAT_RESOLUTION_ORDER) {
    frozen = stage === 'multiplier' ? { base: { ...base }, bonus: { ...bonus } } : undefined
    for (const effect of effects) {
      if (stageOf(effect) !== stage) continue
      if (!statTimeConditionMet(effect.condition, build.inputs)) continue
      const contributions = contributeStats(effect, ctx)
      if (isCombatOnlyCondition(effect.condition)) {
        if (contributions.length > 0) combatContributions.push({ effect, contributions })
        continue
      }
      for (const contribution of contributions) record(contribution)
      if (contributions.length > 0 && effect.support !== 'full') {
        unsupportedEffects.push({
          id: effect.id, support: effect.support, supportNotes: effect.supportNotes,
        })
      }
    }
  }

  const uncappedAttackSpeed = totalAttackSpeed(base.attackSpeed ?? 0, bonus.attackSpeed ?? 0)
  if (uncappedAttackSpeed > ATTACK_SPEED_CAP) {
    const baseAs = base.attackSpeed ?? 0
    const cappedBonusFraction = baseAs > 0 ? (ATTACK_SPEED_CAP / baseAs) - 1 : 0
    record({
      stat: 'attackSpeed', layer: 'bonus', amount: cappedBonusFraction - (bonus.attackSpeed ?? 0),
      source: championSource, usedLevelRangeInterpolation: false,
    })
  }

  const total: Partial<Record<StatKey, number>> = {}
  for (const stat of STAT_KEYS) {
    const baseValue = base[stat] ?? 0
    const bonusValue = bonus[stat] ?? 0
    if (baseValue !== 0 || bonusValue !== 0) {
      total[stat] = stat === 'attackSpeed' ? totalAttackSpeed(baseValue, bonusValue) : baseValue + bonusValue
    }
  }

  return {
    base, bonus, total, breakdown, unsupportedEffects, dataWarnings,
    unverifiedRules: [...unverifiedRules],
    ...(combatContributions.length > 0 ? { combatContributions } : {}),
  }
}
