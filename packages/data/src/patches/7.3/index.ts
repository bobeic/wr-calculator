import type { Champion, Item } from '@wr-calc/schema'
import { buildCatalog, mergeById } from '../../catalog'
import { GENERATED_CHAMPIONS } from './generated/champions'
import { GENERATED_ITEMS } from './generated/items'
import { STARTER_ITEMS } from './items'

export * from './provenance'
export * from './targets'
export { STARTER_ITEMS } from './items'

export const PATCH_7_3_ITEMS: Item[] = mergeById(GENERATED_ITEMS, STARTER_ITEMS)
export const PATCH_7_3_CHAMPIONS: Champion[] = GENERATED_CHAMPIONS
export const PATCH_7_3_CATALOG = buildCatalog(PATCH_7_3_ITEMS, [])
