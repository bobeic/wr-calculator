import type { Champion } from '@wr-calc/schema'
import { byLevelLine, magic, modelled, physical, utility } from './champion-helpers'

// Batch 21 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Rumble (Baron), Skarner (Jungle), Ryze (Mid), Zeri (Dragon) and Rakan (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const RUMBLE = modelled('rumble', {
  // Junkyard Titan's Heat, Danger Zone and Overheat are not modelled (base abilities only).
  passive: utility('rumble-passive', 'Junkyard Titan', 1, null),
  q: {
    id: 'rumble-q', name: 'Flamespitter', maxRank: 4, cooldown: { byRank: [8, 7, 6, 5] }, castTime: 0, flags: {},
    // The 3 seconds of flame at once.
    damage: [magic({ byRank: [100, 140, 180, 220] }, [
      { stat: 'ap', value: 1.25 }, { stat: 'targetMaxHp', value: { byRank: [0.07, 0.08, 0.09, 0.1] } },
    ])],
  },
  // Scrap Shield is a shield and movement speed.
  w: utility('rumble-w', 'Scrap Shield', 4, 5),
  e: {
    id: 'rumble-e', name: 'Electro Harpoon', maxRank: 4, cooldown: 0.5, castTime: 0, flags: {},
    // One harpoon; the 2 charges (6 seconds each) and the Magic Resist shred are not modelled.
    damage: [magic({ byRank: [60, 90, 120, 150] }, [{ stat: 'ap', value: 0.5 }])],
  },
  r: {
    ...utility('rumble-r', 'The Equalizer', 3, { byRank: [80, 70, 60] }),
    effects: [{
      kind: 'dot', id: 'rumble-r-equalizer', name: 'The Equalizer',
      description: 'The burning trail deals 700 (+200% AP) magic damage over 5 seconds.',
      support: 'partial', supportNotes: 'Split into 5 one-second ticks; the target stays in the trail.',
      damageType: 'magic', tickAmount: { byRank: [140, 210, 280] }, tickIntervalSeconds: 1, durationSeconds: 5,
      refresh: 'refresh', appliedBy: ['r'], ratios: [{ stat: 'ap', value: 0.4 }],
    }],
  },
})

const SKARNER = modelled('skarner', {
  passive: {
    id: 'skarner-passive', name: 'Threads of Vibration', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'hitStackProc', id: 'skarner-passive-quaking', name: 'Quaking',
      description: "At 3 stacks of Quaking (from attacks and abilities, for 4 seconds), enemies take 5%-10% (based on "
        + 'level) of their max Health as magic damage over its duration.',
      support: 'partial', supportNotes: 'Seismic Bastion also stacks it here (in game it does not). 4 one-second ticks.',
      stacksToProc: 3, stackWindowSeconds: 4, cooldownSeconds: 4, stacksFrom: ['basicAttack', 'ability'],
      damage: magic(0, [{ stat: 'targetMaxHp', value: byLevelLine(0.0125, 0.025) }]),
      delivery: { kind: 'dot', tickIntervalSeconds: 1, durationSeconds: 4 },
    }],
  },
  q: {
    ...utility('skarner-q', 'Shattered Earth', 4, { byRank: [6.8, 5.5, 4.3, 3] }, 45),
    effects: [
      {
        kind: 'castBuff', id: 'skarner-q-attack-speed', name: 'Shattered Earth (attack speed)',
        description: 'The next 3 attacks gain 25% Attack Speed.', support: 'full',
        slots: ['q'], stat: 'attackSpeed', amount: { byRank: [0.25, 0.3, 0.35, 0.4] }, durationSeconds: 6, cooldownSeconds: 0,
        charges: 3,
      },
      {
        kind: 'empoweredAttack', id: 'skarner-q-shattered-earth', name: 'Shattered Earth',
        description: "The next 3 attacks deal 15 (+100% bonus AD +4% bonus Health) physical damage; the third deals an "
          + "additional 11% of the target's max Health.",
        support: 'partial',
        supportNotes: "The third attack's 11% is spread as 11%/3 over the three. How long the boulder lasts isn't stated "
          + '(6 seconds assumed). Upheaval (the recast) is not modelled.',
        grant: { on: 'abilityCast', slots: ['q'], charges: 3 }, maxCharges: 3, durationSeconds: 6,
        bonus: physical({ byRank: [15, 30, 45, 60] }, [
          { stat: 'bonusAd', value: 1 }, { stat: 'bonusHp', value: 0.04 }, { stat: 'targetMaxHp', value: 0.11 / 3 },
        ]),
      },
    ],
  },
  w: {
    id: 'skarner-w', name: 'Seismic Bastion', maxRank: 4, cooldown: { byRank: [8, 7, 6, 5] }, cost: { byRank: [60, 65, 70, 75] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [50, 70, 90, 110] }, [{ stat: 'ap', value: 0.8 }])],
  },
  e: {
    id: 'skarner-e', name: "Ixtal's Impact", maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    // The target is dragged into a wall.
    damage: [physical({ byRank: [60, 90, 120, 150] }, [{ stat: 'bonusAd', value: 1.2 }, { stat: 'maxHp', value: 0.06 }])],
  },
  r: {
    id: 'skarner-r', name: 'Impale', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 1 }])],
  },
})

const RYZE = modelled('ryze', {
  // Arcane Mastery's bonus Mana (and every ability's bonus Mana ratio) is not modelled.
  passive: utility('ryze-passive', 'Arcane Mastery', 1, null),
  q: {
    id: 'ryze-q', name: 'Overload', maxRank: 4, cooldown: 5, cost: { byRank: [35, 33, 31, 29] }, castTime: 0, flags: {},
    // Without Flux (its +25%, more with Realm Warp, isn't modelled); Rune Prison and Spell Flux don't refresh it here.
    damage: [magic({ byRank: [70, 95, 120, 145] }, [{ stat: 'ap', value: 0.45 }])],
  },
  w: {
    id: 'ryze-w', name: 'Rune Prison', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: { byRank: [35, 50, 65, 80] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [50, 90, 130, 170] }, [{ stat: 'ap', value: 0.55 }])],
  },
  e: {
    id: 'ryze-e', name: 'Spell Flux', maxRank: 4, cooldown: { byRank: [3.3, 3, 2.8, 2.5] }, cost: { byRank: [30, 40, 50, 60] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 110, 140, 170] }, [{ stat: 'ap', value: 0.4 }])],
  },
  // Realm Warp is a teleport.
  r: utility('ryze-r', 'Realm Warp', 3, { byRank: [110, 95, 80] }, 90),
})

const ZERI = modelled('zeri', {
  // Living Battery's 6-round attack (its extra flat damage and AD), the 1.5 Attack Speed cap and the excess-to-AD
  // conversion are not modelled: her attacks are plain attacks here.
  passive: utility('zeri-passive', 'Living Battery', 1, null),
  q: {
    id: 'zeri-q', name: 'Burst Fire', maxRank: 4, cooldown: { byRank: [7.5, 6, 4.5, 3] }, cost: 30, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 100, 130, 160] }, [
      { stat: 'bonusAd', value: 0.8 }, { stat: 'ap', value: { byRank: [0.3, 0.35, 0.4, 0.45] } },
    ])],
  },
  w: {
    id: 'zeri-w', name: 'Ultrashock Laser', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    // The pulse, not the wall-expanded crit.
    damage: [physical({ byRank: [60, 100, 140, 180] }, [{ stat: 'totalAd', value: 1 }, { stat: 'ap', value: 0.5 }])],
  },
  e: {
    ...utility('zeri-e', 'Spark Surge', 4, { byRank: [22, 19.5, 17, 14.5] }, 80),
    effects: [{
      kind: 'empoweredAttack', id: 'zeri-e-spark-surge', name: 'Spark Surge',
      description: 'The next 3 attacks within 6 seconds deal 20 (+10% bonus AD +20% AP) bonus magic damage.',
      support: 'partial', supportNotes: 'The up-to-100% from Critical Rate and the cooldown refunds are not modelled.',
      grant: { on: 'abilityCast', slots: ['e'], charges: 3 }, maxCharges: 3, durationSeconds: 6,
      bonus: magic({ byRank: [20, 23, 26, 29] }, [{ stat: 'bonusAd', value: 0.1 }, { stat: 'ap', value: 0.2 }]),
    }],
  },
  r: {
    id: 'zeri-r', name: 'Lightning Crash', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 225, 300] }, [{ stat: 'bonusAd', value: 0.6 }, { stat: 'ap', value: 1 }])],
    effects: [{
      kind: 'castBuff', id: 'zeri-r-attack-speed', name: 'Lightning Crash',
      description: 'For 5 seconds, gains a 30% Attack Speed bonus.',
      support: 'partial', supportNotes: 'The duration extensions and the chaining triple shot are not modelled.',
      slots: ['r'], stat: 'attackSpeed', amount: 0.3, durationSeconds: 5, cooldownSeconds: 0,
    }],
  },
})

const RAKAN = modelled('rakan', {
  // Fey Feathers is a shield.
  passive: utility('rakan-passive', 'Fey Feathers', 1, null),
  q: {
    id: 'rakan-q', name: 'Gleaming Quill', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [90, 150, 210, 270] }, [{ stat: 'ap', value: 0.6 }])],
  },
  w: {
    id: 'rakan-w', name: 'Grand Entrance', maxRank: 4, cooldown: { byRank: [16, 14, 12, 10] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 135, 200, 265] }, [{ stat: 'ap', value: 0.45 }])],
  },
  // Battle Dance shields an ally.
  e: utility('rakan-e', 'Battle Dance', 4, { byRank: [18, 16, 14, 12] }, { byRank: [60, 70, 80, 90] }),
  r: {
    id: 'rakan-r', name: 'The Quickness', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [100, 200, 300] }, [{ stat: 'ap', value: 0.5 }])],
  },
})

/** The twenty-first batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH21: Champion[] = [RUMBLE, SKARNER, RYZE, ZERI, RAKAN]
