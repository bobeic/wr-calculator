import type { Champion } from '@wr-calc/schema'

/** Indexes champions by id (last one wins on a duplicate id, like buildCatalog). */
export function buildChampionMap(champions: Champion[]): Map<string, Champion> {
  return new Map(champions.map((champion) => [champion.id, champion]))
}
