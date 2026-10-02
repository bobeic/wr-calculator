import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 27 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Poppy (Baron), Nunu & Willump (Jungle) and Annie (Mid); every Dragon- and Support-lane pick is already modelled.
// Same approach as the earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt,
// nothing checked in game yet.

const POPPY = modelled('poppy', {
  passive: {
    id: 'poppy-passive', name: 'Iron Ambassador', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'poppy-passive-iron-ambassador', name: 'Iron Ambassador',
      description: "Every 12 seconds, Poppy's next attack throws her buckler, dealing 20 (based on level) bonus magic damage.",
      support: 'partial', supportNotes: '20 and 12 seconds at every level (the scaling is not stated). The shield is not modelled.',
      triggeredBy: ['basicAttack'], damageType: 'magic', damage: 20, ratios: [], cooldownSeconds: 12,
    }],
  },
  q: {
    id: 'poppy-q', name: 'Hammer Shock', maxRank: 4, cooldown: { byRank: [7, 6, 5, 4] }, cost: { byRank: [30, 35, 40, 45] },
    castTime: 0, flags: {},
    // The smash and the eruption 1 second later, both at once.
    damage: [{
      ...physical({ byRank: [50, 70, 90, 110] }, [{ stat: 'bonusAd', value: 0.9 }, { stat: 'targetMaxHp', value: 0.09 }]),
      hits: 2,
    }],
  },
  w: {
    ...utility('poppy-w', 'Steadfast Presence', 4, { byRank: [19, 16.5, 14, 11.5] }, 40),
    // The active only damages dashing enemies; the doubled resists below 40% Health are not modelled.
    effects: (['armor', 'mr'] as const).map((stat) => ({
      kind: 'statMultiplier' as const, id: `poppy-w-${stat}`, name: `Steadfast Presence (${stat})`,
      description: 'Gains 12% Armor and 12% Magic Resist.', support: 'full' as const,
      stat, layer: 'total' as const, amount: 0.12,
    })),
  },
  e: {
    id: 'poppy-e', name: 'Heroic Charge', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, cost: 60, castTime: 0, flags: {},
    // Tackled into terrain: the initial hit and the collision.
    damage: [{ ...physical({ byRank: [75, 100, 125, 150] }, [{ stat: 'bonusAd', value: 0.5 }]), hits: 2 }],
  },
  r: {
    id: 'poppy-r', name: "Keeper's Verdict", maxRank: 3, cooldown: { byRank: [90, 80, 70] }, cost: 100, castTime: 0, flags: {},
    // Charged (the hold time isn't modelled).
    damage: [physical({ byRank: [200, 300, 400] }, [{ stat: 'bonusAd', value: 0.9 }])],
  },
})

const NUNU = modelled('nunu-willump', {
  // Call of the Freljord's attack speed after damaging a champion is not modelled.
  passive: utility('nunu-willump-passive', 'Call of the Freljord', 1, null),
  q: {
    id: 'nunu-willump-q', name: 'Consume', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [55, 110, 165, 220] }, [{ stat: 'ap', value: 0.65 }, { stat: 'bonusHp', value: 0.05 }])],
  },
  w: {
    id: 'nunu-willump-w', name: 'Biggest Snowball Ever!', maxRank: 4, cooldown: 12, cost: { byRank: [55, 60, 65, 70] },
    castTime: 0, flags: {},
    // The largest snowball (the 12 second roll isn't modelled).
    damage: [magic({ byRank: [175, 240, 305, 370] }, [{ stat: 'ap', value: 1.5 }])],
  },
  e: {
    id: 'nunu-willump-e', name: 'Snowball Barrage', maxRank: 4, cooldown: 12, cost: { byRank: [55, 60, 65, 70] }, castTime: 0, flags: {},
    // The final explosion at its most (every snowball hits); the snowballs' own 8 (+5% AP) each are not modelled.
    damage: [magic(0, [{ stat: 'targetMaxHp', value: 0.15, perStat: { stat: 'ap', value: 0.0004 } }])],
  },
  r: {
    id: 'nunu-willump-r', name: 'Absolute Zero', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    // The full 3 second channel (not modelled as time).
    damage: [magic({ byRank: [915, 1245, 1575] }, [{ stat: 'ap', value: 2.75 }])],
  },
})

const ANNIE = modelled('annie', {
  // Pyromania is a stun.
  passive: utility('annie-passive', 'Pyromania', 1, null),
  q: {
    id: 'annie-q', name: 'Disintegrate', maxRank: 4, cooldown: 4, cost: { byRank: [50, 55, 60, 65] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 130, 180, 230] }, [{ stat: 'ap', value: 0.85 }])],
  },
  w: {
    id: 'annie-w', name: 'Incinerate', maxRank: 4, cooldown: 8, cost: { byRank: [70, 80, 90, 100] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 130, 190, 250] }, [{ stat: 'ap', value: 0.7 }])],
  },
  // Molten Shield is a shield and movement speed.
  e: utility('annie-e', 'Molten Shield', 4, 14, 60),
  r: {
    id: 'annie-r', name: 'Summon: Tibbers', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    // The summon and the recast pounce, both at once. Tibbers' own attacks (70 (+20% AP) each) are not modelled.
    damage: [
      magic({ byRank: [130, 230, 330] }, [{ stat: 'ap', value: 0.6 }]),
      magic({ byRank: [110, 150, 190] }, [{ stat: 'ap', value: 0.3 }]),
    ],
  },
})

/** The twenty-seventh batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH27: Champion[] = [POPPY, NUNU, ANNIE]
