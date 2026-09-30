import type { Champion, Effect } from '@wr-calc/schema'

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

/** The effects a champion's own abilities carry, with rank values bound at each ability's max rank. */
export function championKitEffects(champion: Champion): Effect[] {
  // No per-ability rank input yet: abilities are fully ranked, as in simulateCombo.
  return ABILITY_SLOTS.flatMap((slot) => {
    const ability = champion.abilities[slot]
    return (ability.effects ?? []).map((effect) => bindAbilityRank(effect, ability.maxRank))
  })
}
