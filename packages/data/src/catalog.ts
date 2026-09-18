import type { Item, Rune } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'

/** Builds a StatCatalog (item/rune id -> object maps) from flat arrays. */
export function buildCatalog(items: Item[], runes: Rune[] = []): StatCatalog {
  return {
    items: new Map(items.map((item) => [item.id, item])),
    runes: new Map(runes.map((rune) => [rune.id, rune])),
  }
}
