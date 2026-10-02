import type { Champion, Item, Provenance } from '@wr-calc/schema'
import { STARTER_ITEMS } from '../7.3/items'
import { WRPOCKET_7_3A_PROVENANCE } from './provenance'
import { BATCH6_ITEMS } from './items-batch6'
import { HAND_MODELED_CHAMPIONS_7_3A } from './champions'

/** Values read in the 7.3a practice tool. */
const IN_GAME_7_3A: Provenance = { source: 'in-game', patch: '7.3a', verifiedInGame: true, verifiedAt: '2026-10-01' }

function inherited(id: string): Item {
  const item = STARTER_ITEMS.find((entry) => entry.id === id)
  if (item === undefined) throw new Error(`no 7.3 hand-modelled item ${id}`)
  return item
}

/** The inherited item with one effect replaced (merged over the old one). */
function withEffect(id: string, effectId: string, changes: Record<string, unknown>): Item {
  const item = inherited(id)
  return {
    ...item,
    effects: item.effects.map((effect) => (effect.id === effectId ? { ...effect, ...changes } as Item['effects'][number] : effect)),
    provenance: IN_GAME_7_3A,
  }
}

// Hand-modelled entries re-written for patch 7.3a. Each replaces the inherited entry with the
// same id and clears its stale flag.
export const OVERRIDE_ITEMS: Item[] = [
  {
    id: 'deaths-dance', name: "Death's Dance", tier: 'legendary',
    // 7.3a official notes: price 3200 -> 3300. Everything else is unchanged from 7.3.
    cost: { total: 3300, combine: 400 }, recipe: ['caulfields-warhammer', 'pickaxe', 'chain-vest'],
    // Cauterize and Defy only protect the holder, so a 1v1 damage calculation doesn't model them.
    // 50 AD / 45 armor per the official 7.3 notes (35 -> 50, 40 -> 45); the WR wiki still shows pre-7.3 values.
    stats: { ad: 50, armor: 45, abilityHaste: 15 }, effects: [], tags: ['physical'],
    provenance: WRPOCKET_7_3A_PROVENANCE,
  },
  // Shop tooltip, 2026-10-01: 6% (8% melee). The official 7.3 notes said 7% / 8.5% and the 7.3a notes list no
  // change, so this was an undocumented change; wrpocket's 7.3a text had it right.
  withEffect('blade-of-the-ruined-king', 'botrk-mists-edge', {
    description: "Basic attacks deal bonus physical damage equal to 6% of the target's current Health "
      + '(8% for melee), minimum 15, maximum 100 against monsters.',
    supportNotes: 'The Drain slow is not modeled.',
    pctTargetCurrentHp: 0.08, ranged: { pctTargetCurrentHp: 0.06 },
  }),
  // Practice tool, 2026-10-01 (Ambessa, 10,000 HP / 100 armor dummy, 30% armor pen): the proc dealt 412 after
  // armor, i.e. 700 = 7% max HP, as the (corrected) 7.3 model already says. Marks it verified in game.
  { ...inherited('eclipse'), provenance: IN_GAME_7_3A },
  // Practice tool, 2026-10-01: no Frostbite burn, only Icy's slow (not modelled), as the corrected 7.3 model says.
  { ...inherited('seryldas-grudge'), provenance: IN_GAME_7_3A },
  // Items first modelled on 7.3a (batch 6).
  ...BATCH6_ITEMS,
]
// Champions first hand-modelled on 7.3a (champions.ts).
export const OVERRIDE_CHAMPIONS: Champion[] = [...HAND_MODELED_CHAMPIONS_7_3A]
