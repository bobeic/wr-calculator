import type { Champion, Item } from '@wr-calc/schema'
import { WRPOCKET_7_3A_PROVENANCE } from './provenance'

// Hand-modelled entries re-written for patch 7.3a. Each replaces the inherited entry with the
// same id and clears its stale flag.
export const OVERRIDE_ITEMS: Item[] = [
  {
    id: 'deaths-dance', name: "Death's Dance", tier: 'legendary',
    // 7.3a official notes: price 3200 -> 3300. Everything else is unchanged from 7.3.
    cost: { total: 3300, combine: 400 }, recipe: ['caulfields-warhammer', 'pickaxe', 'chain-vest'],
    // Cauterize and Defy only protect the holder, so a 1v1 damage calculation doesn't model them.
    // wrpocket says 50 AD / 45 armor; the WR wiki says 35 AD / 40 armor.
    stats: { ad: 50, armor: 45, abilityHaste: 15 }, effects: [], tags: ['physical'],
    provenance: WRPOCKET_7_3A_PROVENANCE,
  },
]
export const OVERRIDE_CHAMPIONS: Champion[] = []
