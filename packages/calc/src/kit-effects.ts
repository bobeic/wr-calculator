import type { Build, Champion, Effect } from '@wr-calc/schema'

const ABILITY_SLOTS = ['passive', 'q', 'w', 'e', 'r'] as const

/** Replaces every `{ byRank }` scalar inside a value with its entry at the given rank. */
export function bindAbilityRank<T>(value: T, rank: number): T {
  if (Array.isArray(value)) return value.map((element) => bindAbilityRank(element, rank)) as T
  if (value === null || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const ranks = record.byRank
  if (Array.isArray(ranks) && Object.keys(record).length === 1) {
    if (ranks.length === 0) return value
    return ranks[Math.min(Math.max(Math.round(rank), 1), ranks.length) - 1] as T
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, bindAbilityRank(child, rank)])
  ) as T
}

/** The rank an ability is used at: the build's rank for it, clamped to 1..maxRank, or its max rank. */
export function abilityRankFor(champion: Champion, slot: (typeof ABILITY_SLOTS)[number], ranks?: Build['abilityRanks']): number {
  const ability = champion.abilities[slot]
  const chosen = slot === 'passive' ? undefined : ranks?.[slot]
  return chosen === undefined ? ability.maxRank : Math.min(Math.max(chosen, 1), ability.maxRank)
}

/** The effects a champion's own abilities carry, with rank values bound at each ability's rank (max rank by default). */
export function championKitEffects(champion: Champion, ranks?: Build['abilityRanks']): Effect[] {
  return ABILITY_SLOTS.flatMap((slot) => {
    const ability = champion.abilities[slot]
    return (ability.effects ?? []).map((effect) => bindAbilityRank(effect, abilityRankFor(champion, slot, ranks)))
  })
}
