import type { Item, Rune, SummonerSpell } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'

/** Builds a StatCatalog (item/rune/spell id -> object maps) from flat arrays. */
export function buildCatalog(items: Item[], runes: Rune[] = [], spells: SummonerSpell[] = []): StatCatalog {
  return {
    items: new Map(items.map((item) => [item.id, item])),
    runes: new Map(runes.map((rune) => [rune.id, rune])),
    spells: new Map(spells.map((spell) => [spell.id, spell])),
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

/** Returns a copy of items with each id listed in groups given that exclusiveGroup. */
export function withExclusiveGroups(items: Item[], groups: Record<string, string>): Item[] {
  const ids = new Set(items.map((item) => item.id))
  const unknown = Object.keys(groups).filter((id) => !ids.has(id))
  if (unknown.length > 0) {
    throw new Error(`withExclusiveGroups: unknown item id(s) ${unknown.join(', ')}`)
  }
  return items.map((item) => (groups[item.id] ? { ...item, exclusiveGroup: groups[item.id] } : item))
}
