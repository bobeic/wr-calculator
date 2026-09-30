import type { Champion, Item } from '@wr-calc/schema'
import { buildCatalog, mergeById, withExclusiveGroups } from '../../catalog'
import { EXCLUSIVE_GROUPS } from './exclusive-groups'
import { HAND_MODELED_CHAMPIONS } from './champions'
import { GENERATED_CHAMPIONS } from './generated/champions'
import { GENERATED_ITEMS } from './generated/items'
import { STARTER_ITEMS } from './items'

export * from './provenance'
export * from './targets'
export { STARTER_ITEMS } from './items'
export { HAND_MODELED_CHAMPIONS } from './champions'

export const PATCH_7_3_ITEMS: Item[] = withExclusiveGroups(
  mergeById(GENERATED_ITEMS, STARTER_ITEMS), EXCLUSIVE_GROUPS
)
export const PATCH_7_3_CHAMPIONS: Champion[] = mergeById(GENERATED_CHAMPIONS, HAND_MODELED_CHAMPIONS)
export const PATCH_7_3_CATALOG = buildCatalog(PATCH_7_3_ITEMS, [])
