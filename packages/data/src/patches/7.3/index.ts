import type { Champion, Item } from '@wr-calc/schema'
import { buildCatalog, mergeById, withExclusiveGroups } from '../../catalog'
import { EXCLUSIVE_GROUPS } from './exclusive-groups'
import { HAND_MODELED_CHAMPIONS } from './champions'
import { GENERATED_CHAMPIONS } from './generated/champions'
import { GENERATED_ITEMS } from './generated/items'
import { STARTER_ITEMS } from './items'
import { syncItem } from '../source-sync'
import { attackTypeOf } from '../../attack-types'

export * from './provenance'
export * from './targets'
export { STARTER_ITEMS } from './items'
export { HAND_MODELED_CHAMPIONS } from './champions'

export const PATCH_7_3_ITEMS: Item[] = withExclusiveGroups(
  mergeById(GENERATED_ITEMS, STARTER_ITEMS.map((item) => syncItem(item, GENERATED_ITEMS.find((g) => g.id === item.id)))),
  EXCLUSIVE_GROUPS,
)
export const PATCH_7_3_CHAMPIONS: Champion[] = mergeById(GENERATED_CHAMPIONS, HAND_MODELED_CHAMPIONS)
  .map((champion) => ({ ...champion, attackType: attackTypeOf(champion.id) }))
export const PATCH_7_3_CATALOG = buildCatalog(PATCH_7_3_ITEMS, [])
