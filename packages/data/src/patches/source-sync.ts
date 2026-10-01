import type { Item } from '@wr-calc/schema'

/**
 * Item fields a hand-modelled item takes from its patch's generated entry, so number-only changes
 * (price, recipe, stats) apply without an override. Effects, tags and stats wrpocket doesn't list stay hand-written.
 */
export const SYNCED_ITEM_FIELDS = ['name', 'tier', 'cost', 'recipe'] as const

/** Returns the hand-modelled item with its synced fields and shared stats taken from the generated entry, except pinned ones. */
export function syncItem(hand: Item, generated: Item | undefined): Item {
  if (generated === undefined) return hand
  const pins = new Set(hand.sourcePins ?? [])
  const fields = Object.fromEntries(SYNCED_ITEM_FIELDS.filter((field) => !pins.has(field)).map((field) => [field, generated[field]]))
  const stats = Object.fromEntries(Object.entries(generated.stats).filter(([key]) => !pins.has(`stats.${key}`)))
  const synced: Item = { ...hand, ...fields, stats: { ...hand.stats, ...stats } }
  // A stat wrpocket stops listing can't be told from a hand-only extra here, so the pipeline flags that change for review.
  return synced
}
