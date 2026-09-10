import type { Champion, Build, Item, Rune, Effect, StatKey, NullableScalar } from '@wr-calc/schema'
import { STAT_KEYS } from '@wr-calc/schema'
import {
  MAX_CHAMPION_LEVEL, ATTACK_SPEED_CAP, STAT_RESOLUTION_ORDER, statAtLevel, attackSpeedAtLevel,
  totalAttackSpeed,
} from './rules'
import type { UnverifiedRuleId } from './rules'
import { resolveScalar, scalarWarning } from './resolve-scalar'
import { contributeStats, stageOf } from './effects/registry'
import type { StatContribution, StatContext, StatLayer, StatSource } from './effects/types'
import type { UnsupportedEffectEntry } from './result-envelope'

export interface StatSheet {
  base: Partial<Record<StatKey, number>>
  bonus: Partial<Record<StatKey, number>>
  total: Partial<Record<StatKey, number>>
  breakdown: StatContribution[]
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}

export interface StatCatalog {
  items: Map<string, Item>
  runes: Map<string, Rune>
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
    'maxChampionLevel', 'statGrowthCurve', 'statResolutionOrder', 'attackSpeedRatioGrowth',
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

  const statSoFar = (stat: StatKey, layer: StatLayer | 'total'): number => {
    if (layer === 'base') return base[stat] ?? 0
    if (layer === 'bonus') return bonus[stat] ?? 0
    return (base[stat] ?? 0) + (bonus[stat] ?? 0)
  }

  const itemIds = [
    ...build.items,
    ...(build.boots ? [build.boots] : []),
    ...(build.enchant ? [build.enchant] : []),
  ]
  const items = itemIds.map((id) => {
    const item = catalog.items.get(id)
    if (!item) throw new Error(`resolveStats: unknown item id '${id}' in build`)
    return item
  })
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
    ...items.flatMap((item) => item.effects),
    ...runes.flatMap((rune) => rune.effects),
  ]
  const ctx: StatContext = { level: clampedLevel, inputs: build.inputs, statSoFar }
  for (const stage of STAT_RESOLUTION_ORDER) {
    for (const effect of effects) {
      if (stageOf(effect) !== stage) continue
      const contributions = contributeStats(effect, ctx)
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
  }
}
