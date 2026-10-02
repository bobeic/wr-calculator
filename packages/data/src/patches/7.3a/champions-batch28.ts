import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 28 (2026-10-02): the last unmodelled champions in the CN pick lists (all ranks, 2026-09-30), all Jungle or
// Mid: Hecarim, Diana, Taliyah, Norra, Katarina and Kassadin. Same approach as the earlier batches:
// wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const HECARIM = modelled('hecarim', {
  // Warpath (Attack Speed from bonus Movement Speed) is not modelled.
  passive: utility('hecarim-passive', 'Warpath', 1, null),
  q: {
    id: 'hecarim-q', name: 'Rampage', maxRank: 4, cooldown: { byRank: [4.5, 4, 3.5, 3] }, cost: { byRank: [28, 32, 36, 40] },
    castTime: 0, flags: {},
    // Fully charged on a champion: the 120% crit folded in (5 (+110% AD) x 1.2). The next Rampage's +20% is not modelled.
    damage: [physical({ byRank: [6, 18, 30, 42] }, [{ stat: 'totalAd', value: 1.32 }])],
  },
  w: {
    ...utility('hecarim-w', 'Spirit of Dread', 4, { byRank: [16, 15, 14, 13] }, { byRank: [50, 60, 70, 80] }),
    effects: [{
      kind: 'dot', id: 'hecarim-w-spirit-of-dread', name: 'Spirit of Dread',
      description: 'Deals 12 (+20% AP) magic damage to nearby enemies every 0.5 seconds for 4 seconds.',
      support: 'partial', supportNotes: 'The target stays nearby for all 8 ticks. The resists and healing are not modelled.',
      damageType: 'magic', tickAmount: { byRank: [12, 18, 24, 30] }, tickIntervalSeconds: 0.5, durationSeconds: 4,
      refresh: 'refresh', appliedBy: ['w'], ratios: [{ stat: 'ap', value: 0.2 }],
    }],
  },
  e: {
    ...utility('hecarim-e', 'Devastating Charge', 4, { byRank: [18, 17, 16, 15] }, 60),
    effects: [{
      kind: 'empoweredAttack', id: 'hecarim-e-devastating-charge', name: 'Devastating Charge',
      description: 'His next attack within 5 seconds dashes to the target, dealing 5 (+30% bonus AD) physical damage.',
      support: 'partial', supportNotes: 'The movement speed is not modelled.',
      grant: { on: 'abilityCast', slots: ['e'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: physical({ byRank: [5, 10, 15, 20] }, [{ stat: 'bonusAd', value: 0.3 }]),
    }],
  },
  r: {
    id: 'hecarim-r', name: 'Onslaught of Shadows', maxRank: 3, cooldown: { byRank: [100, 85, 70] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 1 }])],
  },
})

const DIANA = modelled('diana', {
  passive: {
    id: 'diana-passive', name: 'Moonsilver Blade', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'castBuff', id: 'diana-passive-attack-speed', name: 'Moonsilver Blade (attack speed)',
        description: 'After casting an ability, gains 30% Attack Speed for 4 seconds.',
        support: 'partial', supportNotes: '30% at every level (the scaling is not stated).',
        slots: ['q', 'w', 'e', 'r'], stat: 'attackSpeed', amount: 0.3, durationSeconds: 4, cooldownSeconds: 0,
      },
      {
        kind: 'procEveryN', id: 'diana-passive-moonsilver-blade', name: 'Moonsilver Blade',
        description: 'Every third attack deals an additional 35 magic damage.', support: 'full',
        n: 3, countsFrom: 'basicAttack', damageType: 'magic', damage: 35, resetsOnMiss: false,
      },
    ],
  },
  q: {
    id: 'diana-q', name: 'Crescent Strike', maxRank: 4, cooldown: { byRank: [8, 7, 6, 5] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 105, 150, 195] }, [{ stat: 'ap', value: 0.7 }])],
  },
  w: {
    id: 'diana-w', name: 'Pale Cascade', maxRank: 4, cooldown: { byRank: [13, 11.5, 10, 8.5] }, cost: 70, castTime: 0, flags: {},
    // All 3 spheres hit the target.
    damage: [{ ...magic({ byRank: [20, 35, 50, 65] }, [{ stat: 'ap', value: 0.2 }]), hits: 3 }],
  },
  e: {
    id: 'diana-e', name: 'Lunar Rush', maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: 20, castTime: 0, flags: {},
    // The 0.5 second cooldown after removing Moonlight is not modelled.
    damage: [magic({ byRank: [40, 80, 120, 160] }, [{ stat: 'ap', value: 0.3 }])],
  },
  r: {
    id: 'diana-r', name: 'Moonfall', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    // Fully charged.
    damage: [magic({ byRank: [200, 320, 440] }, [{ stat: 'ap', value: 0.8 }])],
  },
})

const TALIYAH = modelled('taliyah', {
  // Rock Surfing is movement speed.
  passive: utility('taliyah-passive', 'Rock Surfing', 1, null),
  q: {
    id: 'taliyah-q', name: 'Threaded Volley', maxRank: 4, cooldown: { byRank: [6, 5, 4, 3] }, cost: { byRank: [60, 65, 70, 75] },
    castTime: 0, flags: {},
    // All 5 rocks hit the target: the first in full, the other 4 at 40%. The Worked Ground boulder is not modelled.
    damage: [
      magic({ byRank: [40, 60, 80, 100] }, [{ stat: 'ap', value: 0.5 }]),
      { ...magic({ byRank: [16, 24, 32, 40] }, [{ stat: 'ap', value: 0.2 }]), hits: 4 },
    ],
  },
  // Seismic Shove is a knockback.
  w: utility('taliyah-w', 'Seismic Shove', 4, { byRank: [14, 12, 10, 8] }, { byRank: [30, 20, 10, 0] }),
  e: {
    id: 'taliyah-e', name: 'Unraveled Earth', maxRank: 4, cooldown: 13, cost: 90, castTime: 0, flags: {},
    // The stones' detonations (on dashes and knockbacks) are not modelled.
    damage: [magic({ byRank: [65, 120, 175, 230] }, [{ stat: 'ap', value: 0.55 }])],
  },
  // Weaver's Wall is a wall.
  r: utility('taliyah-r', "Weaver's Wall", 3, { byRank: [100, 90, 80] }, 100),
})

const NORRA = modelled('norra', {
  // Beloved Trinkets (and Memory Surge's bonus on Threaded targets) are not modelled.
  passive: utility('norra-passive', 'Beloved Trinkets', 1, null),
  q: {
    id: 'norra-q', name: 'Memory Surge', maxRank: 4, cooldown: { byRank: [7.5, 6.5, 5.5, 4.5] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    // Fully charged (x1.4); the charge time is not modelled.
    damage: [magic({ byRank: [77, 154, 231, 308] }, [{ stat: 'ap', value: 0.84 }])],
  },
  w: {
    id: 'norra-w', name: 'Journey to Nowhere', maxRank: 4, cooldown: { byRank: [23, 22, 21, 20] }, cost: { byRank: [75, 80, 85, 90] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [65, 105, 145, 185] }, [{ stat: 'ap', value: 0.4 }])],
  },
  e: {
    id: 'norra-e', name: 'Threads of Homecoming', maxRank: 4, cooldown: { byRank: [12, 10.5, 9, 7.5] }, cost: 65, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 120, 170, 220] }, [{ stat: 'ap', value: 0.6 }])],
  },
  r: {
    id: 'norra-r', name: 'Portalpalooza!', maxRank: 3, cooldown: { byRank: [105, 95, 85] }, cost: 100, castTime: 0, flags: {},
    // All 4 bolts hit the target, at once; the fourth deals 40% more.
    damage: [
      { ...magic({ byRank: [100, 140, 180] }, [{ stat: 'ap', value: 0.55 }]), hits: 3 },
      magic({ byRank: [140, 196, 252] }, [{ stat: 'ap', value: 0.77 }]),
    ],
  },
})

const KATARINA = modelled('katarina', {
  // Voracity's dagger pick-up slashes and cooldown refunds are not modelled.
  passive: utility('katarina-passive', 'Voracity', 1, null),
  q: {
    id: 'katarina-q', name: 'Bouncing Blade', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [75, 115, 155, 195] }, [{ stat: 'ap', value: 0.3 }])],
  },
  // Preparation tosses a Dagger and hastes her.
  w: utility('katarina-w', 'Preparation', 4, { byRank: [14, 13, 12, 11] }),
  e: {
    id: 'katarina-e', name: 'Shunpo', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [20, 50, 80, 110] }, [{ stat: 'totalAd', value: 0.5 }, { stat: 'ap', value: 0.3 }])],
  },
  r: {
    ...utility('katarina-r', 'Death Lotus', 3, { byRank: [60, 50, 40] }),
    effects: [{
      kind: 'dot', id: 'katarina-r-death-lotus', name: 'Death Lotus',
      description: 'Throws 20 daggers over 2.6 seconds, up to 400 (+260% bonus AD +290% AP) magic damage in all.',
      support: 'partial', supportNotes: 'Every dagger hits the target: 20 ticks of a twentieth each. Grievous Wounds is not modelled.',
      damageType: 'magic', tickAmount: { byRank: [20, 30, 40] }, tickIntervalSeconds: 0.13, durationSeconds: 2.6,
      refresh: 'refresh', appliedBy: ['r'], ratios: [{ stat: 'ad', layer: 'bonus', value: 0.13 }, { stat: 'ap', value: 0.145 }],
    }],
  },
})

const KASSADIN = modelled('kassadin', {
  // Void Stone is a magic shield.
  passive: utility('kassadin-passive', 'Void Stone', 1, null),
  q: {
    id: 'kassadin-q', name: 'Null Sphere', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: { byRank: [70, 75, 80, 85] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 145, 210, 275] }, [{ stat: 'ap', value: 0.8 }])],
  },
  w: {
    ...utility('kassadin-w', 'Nether Blade', 4, 10, 20),
    effects: [{
      kind: 'empoweredAttack', id: 'kassadin-w-nether-blade', name: 'Nether Blade',
      description: 'His next attack within 4 seconds deals an additional 50 (+50% AP) magic damage.',
      support: 'partial', supportNotes: 'The Mana restore is not modelled.',
      grant: { on: 'abilityCast', slots: ['w'], charges: 1 }, maxCharges: 1, durationSeconds: 4,
      bonus: magic({ byRank: [50, 80, 110, 140] }, [{ stat: 'ap', value: 0.5 }]),
    }],
  },
  e: {
    id: 'kassadin-e', name: 'Force Pulse', maxRank: 4, cooldown: { byRank: [12, 10, 8, 6] }, cost: { byRank: [70, 75, 80, 85] },
    castTime: 0, flags: {},
    // Un-enhanced (the +40% after 6 nearby casts is not modelled).
    damage: [magic({ byRank: [60, 100, 140, 180] }, [{ stat: 'ap', value: 0.6 }])],
  },
  r: {
    id: 'kassadin-r', name: 'Riftwalk', maxRank: 3, cooldown: { byRank: [5, 3.5, 2] }, castTime: 0, flags: {},
    // One unstacked cast; the 1.5% max Mana ratio and the +50% per stack are not modelled.
    damage: [magic({ byRank: [80, 100, 120] }, [{ stat: 'ap', value: 0.3 }])],
  },
})

/** The twenty-eighth batch: the last unmodelled champions in the CN pick lists. */
export const HAND_MODELED_CHAMPIONS_BATCH28: Champion[] = [HECARIM, DIANA, TALIYAH, NORRA, KATARINA, KASSADIN]
