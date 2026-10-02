import type { Champion } from '@wr-calc/schema'
import { byLevelLine, magic, modelled, physical, utility } from './champion-helpers'

// Batch 16 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Gnar (Baron), Rammus (Jungle), Zed (Mid), Varus (Dragon) and Alistar (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const GNAR = modelled('gnar', {
  passive: {
    id: 'gnar-passive', name: 'Rage Gene', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'stat', id: 'gnar-passive-mini-attack-speed', name: 'Rage Gene (Mini Gnar)',
      description: 'Mini Gnar gains 0% Attack Speed (max 90%) (based on level).',
      support: 'partial',
      supportNotes: 'Mini Gnar only, in a straight line from 0% at level 1 to 90% at 15. Mega Gnar (stats and '
        + 'abilities) is not modelled, except that GNAR! below is his.',
      stat: 'attackSpeed', amount: byLevelLine(0, 0.9),
    }],
  },
  q: {
    id: 'gnar-q', name: 'Boomerang Throw', maxRank: 4, cooldown: { byRank: [16, 14, 12, 10] }, castTime: 0, flags: {},
    // Mini Gnar's boomerang; each enemy is hit once. The 40% refund for catching it is not modelled.
    damage: [physical({ byRank: [5, 55, 105, 155] }, [{ stat: 'totalAd', value: 1.25 }])],
  },
  w: {
    ...utility('gnar-w', 'Hyper', 4, { byRank: [20, 19, 18, 17] }),
    effects: [
      {
        kind: 'hitStackProc', id: 'gnar-w-hyper', name: 'Hyper',
        description: "Every third attack or ability on the same enemy deals an additional 10 (+100% AP) plus 7% of the "
          + "target's max Health as magic damage.",
        support: 'partial', supportNotes: "The window for the 3 hits isn't stated (3.5 seconds assumed).",
        stacksToProc: 3, stackWindowSeconds: 3.5, cooldownSeconds: 0, stacksFrom: ['basicAttack', 'ability'],
        damage: magic({ byRank: [10, 20, 30, 40] }, [
          { stat: 'ap', value: 1 }, { stat: 'targetMaxHp', value: { byRank: [0.07, 0.09, 0.11, 0.13] } },
        ]),
        delivery: { kind: 'instant' },
      },
      {
        kind: 'castBuff', id: 'gnar-w-active', name: 'Hyper (active)',
        description: 'Gains 35% Attack Speed for 6 seconds.', support: 'full',
        slots: ['w'], stat: 'attackSpeed', amount: { byRank: [0.35, 0.4, 0.45, 0.5] }, durationSeconds: 6, cooldownSeconds: 0,
      },
    ],
  },
  e: {
    id: 'gnar-e', name: 'Hop', maxRank: 4, cooldown: { byRank: [21, 18, 15, 12] }, castTime: 0, flags: {},
    damage: [physical({ byRank: [50, 95, 140, 185] }, [{ stat: 'maxHp', value: 0.06 }])],
  },
  r: {
    id: 'gnar-r', name: 'GNAR!', maxRank: 3, cooldown: { byRank: [60, 45, 30] }, castTime: 0, flags: {},
    // Mega Gnar only (the combo decides when he is); without the wall bonus.
    damage: [physical({ byRank: [200, 300, 400] }, [{ stat: 'bonusAd', value: 0.5 }, { stat: 'ap', value: 1 }])],
  },
})

const RAMMUS = modelled('rammus', {
  // Rolling Armordillo is movement speed.
  passive: utility('rammus-passive', 'Rolling Armordillo', 1, null),
  q: {
    id: 'rammus-q', name: 'Powerball', maxRank: 4, cooldown: { byRank: [12, 10, 8, 6] }, cost: 65, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 110, 140, 170] }, [{ stat: 'ap', value: 1 }])],
  },
  w: {
    ...utility('rammus-w', 'Defensive Ball Curl', 4, 7, 40),
    effects: [{
      kind: 'onHit', id: 'rammus-w-spiked-shell', name: 'Spiked Shell',
      description: 'Attacks deal 12 (+10% Armor) bonus magic damage.',
      support: 'partial',
      supportNotes: 'The curl (Armor and Magic Resist, +40% Spiked Shell damage, damage to attackers) is not modelled.',
      damageType: 'magic', flat: { byRank: [12, 14, 16, 18] }, ratios: [{ stat: 'armor', value: 0.1 }],
    }],
  },
  e: {
    ...utility('rammus-e', 'Frenzying Taunt', 4, { byRank: [13.5, 13, 12.5, 12] }, 50),
    effects: [{
      kind: 'castBuff', id: 'rammus-e-attack-speed', name: 'Frenzying Taunt',
      description: 'Gains 35% Attack Speed for 5 seconds.', support: 'full',
      slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.35, 0.45, 0.55, 0.65] }, durationSeconds: 5, cooldownSeconds: 0,
    }],
  },
  r: {
    id: 'rammus-r', name: 'Soaring Slam', maxRank: 3, cooldown: { byRank: [70, 60, 50] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [75, 150, 225] }, [{ stat: 'ap', value: 0.5 }])],
    effects: [{
      kind: 'dot', id: 'rammus-r-aftershocks', name: 'Soaring Slam (aftershocks)',
      description: 'Aftershocks deal 30 (+20% AP) magic damage every second for 4 seconds.',
      support: 'partial', supportNotes: 'The target stays in the area for all 4 seconds.',
      damageType: 'magic', tickAmount: { byRank: [30, 45, 60] }, tickIntervalSeconds: 1, durationSeconds: 4,
      refresh: 'refresh', appliedBy: ['r'], ratios: [{ stat: 'ap', value: 0.2 }],
    }],
  },
})

// Zed uses Energy, not Mana, so his costs are left out. His shadows (Living Shadow, Death Mark's) are not modelled.
const ZED = modelled('zed', {
  passive: {
    id: 'zed-passive', name: 'Contempt for the Weak', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'zed-passive-contempt', name: 'Contempt for the Weak',
      description: "Zed's attacks against enemies below 50% Health deal bonus magic damage equal to 7% (based on level) "
        + 'of their max Health (10 second cooldown per unique enemy).',
      support: 'partial',
      supportNotes: "7% at every level (the scaling isn't stated). The target's Health is checked after the attack lands.",
      condition: { type: 'targetHpBelow', threshold: 0.5 },
      triggeredBy: ['basicAttack'], damageType: 'magic', damage: 0, ratios: [], pctTargetMaxHp: 0.07, cooldownSeconds: 10,
    }],
  },
  q: {
    id: 'zed-q', name: 'Razor Shuriken', maxRank: 4, cooldown: 6, castTime: 0, flags: {},
    // Zed's own shuriken only.
    damage: [physical({ byRank: [70, 120, 170, 220] }, [{ stat: 'bonusAd', value: 1.1 }])],
  },
  // Living Shadow places a shadow.
  w: utility('zed-w', 'Living Shadow', 4, { byRank: [17, 16, 15, 14] }),
  e: {
    id: 'zed-e', name: 'Shadow Slash', maxRank: 4, cooldown: { byRank: [5, 4.5, 4, 3.5] }, castTime: 0, flags: {},
    // Zed's own slash only.
    damage: [physical({ byRank: [65, 95, 125, 155] }, [{ stat: 'bonusAd', value: 0.7 }])],
  },
  r: {
    id: 'zed-r', name: 'Death Mark', maxRank: 3, cooldown: { byRank: [85, 70, 55] }, castTime: 0, flags: {},
    // Only the 100% AD, at once: the 30-55% of the damage dealt during the mark isn't modelled (no hook records
    // damage over a window).
    damage: [physical(0, [{ stat: 'totalAd', value: 1 }])],
  },
})

const VARUS = modelled('varus', {
  // Living Vengeance needs a takedown.
  passive: utility('varus-passive', 'Living Vengeance', 1, null),
  q: {
    id: 'varus-q', name: 'Piercing Arrow', maxRank: 4, cooldown: { byRank: [15, 14, 13, 12] }, cost: { byRank: [75, 80, 85, 90] },
    castTime: 0, flags: {},
    // Fully charged (the charge-up time isn't modelled).
    damage: [physical({ byRank: [120, 210, 300, 390] }, [{ stat: 'bonusAd', value: 1.65 }])],
  },
  w: {
    ...utility('varus-w', 'Blighted Quiver', 4, 25),
    effects: [
      {
        kind: 'onHit', id: 'varus-w-on-hit', name: 'Blighted Quiver',
        description: 'Attacks deal 15 (+35% AP) bonus magic damage.', support: 'full',
        damageType: 'magic', flat: { byRank: [15, 25, 35, 45] }, ratios: [{ stat: 'ap', value: 0.35 }],
      },
      {
        kind: 'abilityHitProc', id: 'varus-w-blight', name: 'Blight',
        description: "Attacks apply Blight (max 3 stacks). His other abilities hitting an enemy with Blight detonate it, "
          + "dealing 3% (+0.012% per AP) of the target's max Health as magic damage per stack.",
        support: 'partial',
        supportNotes: 'Every ability hit detonates 3 stacks, whether or not 3 attacks came first, so it is generous when '
          + 'abilities open a combo. The AP part and the cooldown cut are not modelled.',
        damageType: 'magic', damage: 0, ratios: [], pctTargetMaxHp: { byRank: [0.09, 0.105, 0.12, 0.135] }, cooldownSeconds: 0,
      },
    ],
  },
  e: {
    id: 'varus-e', name: 'Hail of Arrows', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, cost: 80, castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 115, 160, 205] }, [{ stat: 'bonusAd', value: 0.9 }])],
  },
  r: {
    id: 'varus-r', name: 'Chain of Corruption', maxRank: 3, cooldown: { byRank: [75, 65, 55] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.8 }])],
  },
})

const ALISTAR = modelled('alistar', {
  // Triumphant Roar heals.
  passive: utility('alistar-passive', 'Triumphant Roar', 1, null),
  q: {
    id: 'alistar-q', name: 'Pulverize', maxRank: 4, cooldown: { byRank: [13.5, 12, 10.5, 9] }, cost: { byRank: [65, 70, 75, 80] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 110, 160, 210] }, [{ stat: 'ap', value: 0.5 }])],
  },
  w: {
    id: 'alistar-w', name: 'Headbutt', maxRank: 4, cooldown: { byRank: [13.5, 12, 10.5, 9] }, cost: { byRank: [65, 70, 75, 80] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [50, 120, 190, 260] }, [{ stat: 'ap', value: 0.6 }])],
  },
  e: {
    id: 'alistar-e', name: 'Trample', maxRank: 4, cooldown: { byRank: [11.5, 11, 10.5, 10] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    // The first of 10 ticks (the max of 100 (+40% AP) spread evenly); the dot below deals the other 9.
    damage: [magic({ byRank: [10, 15, 20, 25] }, [{ stat: 'ap', value: 0.04 }])],
    effects: [
      {
        kind: 'dot', id: 'alistar-e-trample', name: 'Trample',
        description: 'Deals magic damage every 0.5 seconds for 5 seconds, up to a max of 100 (+40% AP).',
        support: 'partial', supportNotes: 'The target stays in range for all 5 seconds.',
        damageType: 'magic', tickAmount: { byRank: [10, 15, 20, 25] }, tickIntervalSeconds: 0.5, durationSeconds: 4.5,
        refresh: 'refresh', appliedBy: ['e'], ratios: [{ stat: 'ap', value: 0.04 }],
      },
      {
        kind: 'empoweredAttack', id: 'alistar-e-empowered', name: 'Trample (empowered attack)',
        description: "If Trample damages an enemy champion 5 times, Alistar's next attack within 5 seconds deals an "
          + 'additional 40 (based on level) magic damage and stuns.',
        support: 'partial',
        supportNotes: 'Granted on the cast (5 hits assumed). 40 at every level (the scaling isn\'t stated).',
        grant: { on: 'abilityCast', slots: ['e'], charges: 1 }, maxCharges: 1, durationSeconds: 7.5,
        bonus: magic(40, []),
      },
    ],
  },
  // Unbreakable Will is damage reduction.
  r: utility('alistar-r', 'Unbreakable Will', 3, { byRank: [75, 65, 55] }, 100),
})

/** The sixteenth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH16: Champion[] = [GNAR, RAMMUS, ZED, VARUS, ALISTAR]
