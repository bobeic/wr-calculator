import type { Champion, Item } from '@wr-calc/schema'

// Hand-modelled entries re-written for patch 7.3a. Each replaces the inherited entry with the
// same id and clears its stale flag.
export const OVERRIDE_ITEMS: Item[] = []
export const OVERRIDE_CHAMPIONS: Champion[] = []
