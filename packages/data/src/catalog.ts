import type { Item, Rune } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'

/** Builds a StatCatalog (item/rune id -> object maps) from flat arrays. */
export function buildCatalog(items: Item[], runes: Rune[] = []): StatCatalog {
  return {
    items: new Map(items.map((item) => [item.id, item])),
    runes: new Map(runes.map((rune) => [rune.id, rune])),
  }
}

/** Merges overrides into base by id: base order kept, same ids replaced, new ids appended. */
export function mergeById<T extends { id: string }>(base: T[], overrides: T[]): T[] {
  const overrideById = new Map(overrides.map((entry) => [entry.id, entry]))
  const baseIds = new Set(base.map((entry) => entry.id))
  return [
    ...base.map((entry) => overrideById.get(entry.id) ?? entry),
    ...overrides.filter((entry) => !baseIds.has(entry.id)),
  ]
}
