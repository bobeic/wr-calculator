import type { Champion, Item } from '@wr-calc/schema'

/**
 * Item fields a hand-modelled item takes from its patch's generated entry, so number-only changes
 * (price, recipe, stats) apply without an override. Effects, tags and stats wrpocket doesn't list stay hand-written.
 */
export const SYNCED_ITEM_FIELDS = ['name', 'tier', 'cost', 'recipe', 'uniquePassives'] as const

/** Returns the hand-modelled item with its synced fields and shared stats taken from the generated entry, except pinned ones. */
export function syncItem(hand: Item, generated: Item | undefined): Item {
  if (generated === undefined) return hand
  const pins = new Set(hand.sourcePins ?? [])
  const fields = Object.fromEntries(SYNCED_ITEM_FIELDS
    .filter((field) => !pins.has(field) && generated[field] !== undefined)
    .map((field) => [field, generated[field]]))
  const stats = Object.fromEntries(Object.entries(generated.stats).filter(([key]) => !pins.has(`stats.${key}`)))
  const synced: Item = { ...hand, ...fields, stats: { ...hand.stats, ...stats } }
  // A stat wrpocket stops listing can't be told from a hand-only extra here, so the pipeline flags that change for review.
  return synced
}

/**
 * Returns the hand-modelled champion with base stats and attack speed taken from the generated entry (wrpocket's level
 * table), except pinned ones ('baseStats.ad', 'attackSpeed'). Abilities stay hand-modelled; their numbers move through
 * champion links (src/patches/champion-links.ts).
 */
export function syncChampion(hand: Champion, generated: Champion | undefined): Champion {
  if (generated === undefined) return hand
  const pins = new Set(hand.sourcePins ?? [])
  const baseStats = { ...hand.baseStats }
  for (const [key, growth] of Object.entries(generated.baseStats) as Array<[keyof Champion['baseStats'], Champion['baseStats'][keyof Champion['baseStats']]]>) {
    if (!pins.has(`baseStats.${key}`)) baseStats[key] = growth
  }
  return { ...hand, baseStats, attackSpeed: pins.has('attackSpeed') ? hand.attackSpeed : generated.attackSpeed }
}
