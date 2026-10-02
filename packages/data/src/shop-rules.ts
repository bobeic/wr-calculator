// Shop rules read in the client that the imported data can't express.

/**
 * Passive names wrpocket's text gives several items that the shop still lets one build hold together, so they don't
 * block each other (Item.uniquePassives). Icy: Rylai's Crystal Scepter and Serylda's Grudge can be bought together
 * (user, 2026-10-03).
 */
export const NON_BLOCKING_PASSIVES: ReadonlySet<string> = new Set(['Icy'])

/** The item without passive names that don't block; unchanged when it lists none of them. */
export function withoutNonBlockingPassives<T extends { uniquePassives?: string[] }>(item: T): T {
  if (!item.uniquePassives?.some((name) => NON_BLOCKING_PASSIVES.has(name))) return item
  const kept = item.uniquePassives.filter((name) => !NON_BLOCKING_PASSIVES.has(name))
  const { uniquePassives: _dropped, ...rest } = item
  return (kept.length > 0 ? { ...rest, uniquePassives: kept } : rest) as T
}
