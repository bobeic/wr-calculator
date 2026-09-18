import { buildCatalog } from '../../catalog'
import { PATCH_7_3_ITEMS } from './items'

export * from './provenance'
export * from './items'
export * from './champions'

export const PATCH_7_3_CATALOG = buildCatalog(PATCH_7_3_ITEMS, [])
