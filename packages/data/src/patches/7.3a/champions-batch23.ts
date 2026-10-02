import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 23 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Kennen (Baron), Olaf (Jungle), Lissandra (Mid) and Milio (Support); every Dragon-lane pick is already modelled. Same
// approach as the earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing
// checked in game yet.

const OLAF_RAGNAROK = 'olaf-ragnarok-active'

const KENNEN = modelled('kennen', {
  // Mark of the Storm is a stun.
  passive: utility('kennen-passive', 'Mark of the Storm', 1, null),
  q: {
    id: 'kennen-q', name: 'Thundering Shuriken', maxRank: 4, cooldown: { byRank: [7, 6, 5, 4] }, cost: { byRank: [60, 55, 50, 45] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [75, 140, 205, 270] }, [{ stat: 'ap', value: 0.75 }])],
  },
  w: {
    id: 'kennen-w', name: 'Electrical Surge', maxRank: 4, cooldown: { byRank: [12, 10, 8, 6] }, cost: 40, castTime: 0, flags: {},
    // The target is assumed to carry a Mark of the Storm.
    damage: [magic({ byRank: [70, 100, 130, 160] }, [{ stat: 'ap', value: 0.8 }])],
    effects: [{
      kind: 'procEveryN', id: 'kennen-w-electrical-surge', name: 'Electrical Surge (passive)',
      description: 'Every 5th attack deals 55 (+70% bonus AD +30% AP) bonus magic damage.', support: 'full',
      n: 5, countsFrom: 'basicAttack', damageType: 'magic', damage: { byRank: [55, 65, 75, 85] },
      ratios: [{ stat: 'ad', layer: 'bonus', value: { byRank: [0.7, 0.8, 0.9, 1] } }, { stat: 'ap', value: 0.3 }],
      resetsOnMiss: false,
    }],
  },
  e: {
    id: 'kennen-e', name: 'Lightning Rush', maxRank: 4, cooldown: { byRank: [7.5, 7, 6.5, 6] }, cost: { byRank: [100, 95, 90, 85] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 120, 170, 220] }, [{ stat: 'ap', value: 0.7 }])],
    effects: [{
      kind: 'castBuff', id: 'kennen-e-attack-speed', name: 'Lightning Rush',
      description: 'Gains 50% Attack Speed for 3 seconds upon exiting Lightning Rush.',
      support: 'partial', supportNotes: "Starts on the cast (the 2 seconds as a ball, when he can't attack, are not modelled).",
      slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.5, 0.6, 0.7, 0.8] }, durationSeconds: 3, cooldownSeconds: 0,
    }],
  },
  r: {
    ...utility('kennen-r', 'Slicing Maelstrom', 3, { byRank: [80, 75, 70] }),
    effects: [{
      kind: 'dot', id: 'kennen-r-maelstrom', name: 'Slicing Maelstrom',
      description: 'Deals 20 (+13% AP) magic damage to enemies in the area every 0.5 seconds for 3 seconds.',
      support: 'partial',
      supportNotes: 'The target stays in the storm for all 6 bolts. Each bolt dealing 10% more than the last and the '
        + 'Armor and Magic Resist are not modelled.',
      damageType: 'magic', tickAmount: { byRank: [20, 55, 90] }, tickIntervalSeconds: 0.5, durationSeconds: 3,
      refresh: 'refresh', appliedBy: ['r'], ratios: [{ stat: 'ap', value: 0.13 }],
    }],
  },
})

const OLAF = modelled('olaf', {
  // Berserker Rage's Attack Speed and Physical Vamp from his own missing Health are not modelled.
  passive: utility('olaf-passive', 'Berserker Rage', 1, null),
  q: {
    id: 'olaf-q', name: 'Undertow', maxRank: 4, cooldown: 7, cost: { byRank: [45, 50, 55, 60] }, castTime: 0, flags: {},
    // The 20% Armor reduction and the pick-up refund are not modelled.
    damage: [physical({ byRank: [50, 115, 180, 245] }, [{ stat: 'bonusAd', value: 1.05 }])],
  },
  w: {
    ...utility('olaf-w', 'Vicious Strikes', 4, { byRank: [15, 14, 13, 12] }, 30),
    effects: [{
      kind: 'castBuff', id: 'olaf-w-attack-speed', name: 'Vicious Strikes',
      description: 'Gains 35% Attack Speed for 4 seconds.', support: 'partial', supportNotes: 'The shield is not modelled.',
      slots: ['w'], stat: 'attackSpeed', amount: { byRank: [0.35, 0.5, 0.65, 0.8] }, durationSeconds: 4, cooldownSeconds: 0,
    }],
  },
  e: {
    id: 'olaf-e', name: 'Reckless Swing', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, castTime: 0, flags: {},
    // The recoil on Olaf and the 1 second per attack refund are not modelled.
    damage: [{ type: 'true', base: { byRank: [45, 95, 145, 195] }, ratios: [{ stat: 'totalAd', value: 0.55 }], tags: [] }],
  },
  r: {
    ...utility('olaf-r', 'Ragnarok', 3, { byRank: [60, 55, 50] }),
    effects: [
      {
        kind: 'stat', id: 'olaf-r-armor', name: 'Ragnarok (passive Armor)', description: 'Gains 15 Armor.',
        support: 'full', stat: 'armor', amount: { byRank: [15, 25, 35] },
      },
      {
        kind: 'stat', id: 'olaf-r-mr', name: 'Ragnarok (passive Magic Resist)', description: 'Gains 15 Magic Resist.',
        support: 'full', stat: 'mr', amount: { byRank: [15, 25, 35] },
      },
      {
        kind: 'castBuff', id: 'olaf-r-flat-ad', name: 'Ragnarok',
        description: 'Gains 5 Attack Damage for 4 seconds.',
        support: 'partial', supportNotes: 'Extended by 2.5 seconds per attack in game; not modelled.',
        slots: ['r'], stat: 'ad', amount: { byRank: [5, 15, 25] }, durationSeconds: 4, cooldownSeconds: 0,
      },
      {
        kind: 'statMultiplier', id: 'olaf-r-ragnarok', name: 'Ragnarok (+20% AD)',
        description: 'While Ragnarok is active, gains 20% Attack Damage.',
        support: 'partial',
        supportNotes: 'A toggle says whether it is active for the whole combo; casting R does not switch it on.',
        inputs: [{ type: 'boolean', id: OLAF_RAGNAROK, label: 'Olaf: Ragnarok active', default: false }],
        condition: { type: 'toggle', inputId: OLAF_RAGNAROK },
        stat: 'ad', layer: 'total', amount: 0.2,
      },
    ],
  },
})

const LISSANDRA = modelled('lissandra', {
  // Iceborn Subjugation needs a takedown.
  passive: utility('lissandra-passive', 'Iceborn Subjugation', 1, null),
  q: {
    id: 'lissandra-q', name: 'Ice Shard', maxRank: 4, cooldown: { byRank: [7, 6, 5, 4] }, cost: { byRank: [55, 60, 65, 70] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 110, 150, 190] }, [{ stat: 'ap', value: 0.7 }])],
  },
  w: {
    id: 'lissandra-w', name: 'Ring of Frost', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] }, cost: 40, castTime: 0, flags: {},
    damage: [magic({ byRank: [55, 100, 145, 190] }, [{ stat: 'ap', value: 0.55 }])],
  },
  e: {
    id: 'lissandra-e', name: 'Glacial Path', maxRank: 4, cooldown: { byRank: [20, 17, 14, 11] }, cost: { byRank: [85, 90, 95, 100] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [50, 95, 140, 185] }, [{ stat: 'ap', value: 0.4 }])],
  },
  r: {
    id: 'lissandra-r', name: 'Frozen Tomb', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // Cast on the enemy.
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.75 }])],
  },
})

const MILIO = modelled('milio', {
  // Fired Up! empowers allies.
  passive: utility('milio-passive', 'Fired Up!', 1, null),
  q: {
    id: 'milio-q', name: 'Ultra Mega Fire Kick', maxRank: 4, cooldown: 10, cost: { byRank: [50, 55, 60, 65] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 160, 240, 320] }, [{ stat: 'ap', value: 0.8 }])],
  },
  // Cozy Campfire, Warm Hugs and Breath of Life heal, shield and buff allies.
  w: utility('milio-w', 'Cozy Campfire', 4, { byRank: [24, 22, 20, 18] }, { byRank: [90, 100, 110, 120] }),
  e: utility('milio-e', 'Warm Hugs', 4, 0.5, { byRank: [50, 60, 70, 80] }),
  r: utility('milio-r', 'Breath of Life', 3, { byRank: [100, 90, 80] }, { byRank: [100, 85, 70] }),
})

/** The twenty-third batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH23: Champion[] = [KENNEN, OLAF, LISSANDRA, MILIO]
