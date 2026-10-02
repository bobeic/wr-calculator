import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 11 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Teemo (Baron), Pantheon (Jungle), Ziggs (Mid), Ezreal (Dragon) and Pyke (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const TEEMO = modelled('teemo', {
  passive: {
    id: 'teemo-passive', name: 'Toxic Shot', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'onHit', id: 'teemo-passive-toxic-shot', name: 'Toxic Shot (impact)',
        description: 'Attacks deal 8 (+20% AP) bonus magic damage on impact.', support: 'full',
        damageType: 'magic', flat: 8, ratios: [{ stat: 'ap', value: 0.2 }],
      },
      {
        kind: 'dot', id: 'teemo-passive-poison', name: 'Toxic Shot (poison)',
        description: 'Attacks deal an additional 8 (+9% AP) magic damage each second for 4 seconds.',
        support: 'partial', supportNotes: 'Each attack restarts the poison (assumed not to stack).',
        damageType: 'magic', tickAmount: 8, tickIntervalSeconds: 1, durationSeconds: 4, refresh: 'refresh',
        appliedBy: ['basicAttack'], ratios: [{ stat: 'ap', value: 0.09 }],
      },
    ],
  },
  q: {
    id: 'teemo-q', name: 'Blinding Dart', maxRank: 4, cooldown: 8, cost: { byRank: [75, 80, 85, 90] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [50, 95, 140, 185] }, [{ stat: 'ap', value: 0.5 }])],
  },
  // Move Quick is movement speed.
  w: utility('teemo-w', 'Move Quick', 4, { byRank: [17, 16, 15, 14] }, 40),
  // Guerilla Warfare's attack speed comes after leaving camouflage; not modelled.
  e: utility('teemo-e', 'Guerilla Warfare', 4, { byRank: [25, 23, 21, 19] }, 60),
  r: {
    id: 'teemo-r', name: 'Noxious Trap', maxRank: 3, cooldown: 1, cost: 75, castTime: 0, flags: {},
    // One mushroom, its 3 seconds of damage at once. The trap charges (one per 30/25/20s) are not modelled.
    damage: [magic({ byRank: [225, 350, 475] }, [{ stat: 'ap', value: 0.5 }])],
  },
})

const PANTHEON = modelled('pantheon', {
  // Mortal Will empowers every 5th basic ability; not modelled (no hook counts attacks and abilities into an
  // ability empower).
  passive: utility('pantheon-passive', 'Mortal Will', 1, null),
  q: {
    id: 'pantheon-q', name: 'Comet Spear', maxRank: 4, cooldown: { byRank: [8.5, 8, 7.5, 7] }, cost: 40, castTime: 0, flags: {},
    // The crit against targets below 25% Health (120-390 +180% bonus AD) and the tap cast's 60% refund are not modelled.
    damage: [physical({ byRank: [80, 120, 160, 200] }, [{ stat: 'bonusAd', value: 1.2 }])],
  },
  w: {
    id: 'pantheon-w', name: 'Shield Vault', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: 55, castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 120, 170, 220] }, [{ stat: 'ap', value: 1 }])],
  },
  e: {
    id: 'pantheon-e', name: 'Aegis Assault', maxRank: 4, cooldown: { byRank: [15, 14, 13, 12] }, cost: 80, castTime: 0, flags: {},
    // The 1.5 second block's 100% AD and the closing slam, both at once.
    damage: [
      physical(0, [{ stat: 'totalAd', value: 1 }]),
      physical({ byRank: [60, 120, 180, 240] }, [{ stat: 'bonusAd', value: 1.5 }]),
    ],
  },
  r: {
    id: 'pantheon-r', name: 'Grand Starfall', maxRank: 3, cooldown: { byRank: [90, 80, 70] }, cost: 100, castTime: 0, flags: {},
    // The spear is Comet Spear's damage, taken at Comet Spear's rank 4 (200 +120% bonus AD), then the landing at the
    // centre of the area.
    damage: [
      physical(200, [{ stat: 'bonusAd', value: 1.2 }]),
      magic({ byRank: [300, 500, 700] }, [{ stat: 'ap', value: 1 }]),
    ],
    effects: [{
      kind: 'stat', id: 'pantheon-r-passive', name: 'Grand Starfall (passive)', description: 'Gains 10% Armor Penetration.',
      support: 'full', stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
    }],
  },
})

const ZIGGS = modelled('ziggs', {
  // Short Fuse's extra 20 (+15% AP) is folded into Bouncing Bomb below.
  passive: utility('ziggs-passive', 'Short Fuse', 1, null),
  q: {
    id: 'ziggs-q', name: 'Bouncing Bomb', maxRank: 4, cooldown: { byRank: [5.5, 5, 4.5, 4] }, cost: { byRank: [55, 60, 65, 70] },
    castTime: 0, flags: {},
    // Plus Short Fuse, assumed ready on every bomb: its cooldown isn't stated and each cast cuts it by 4 seconds.
    damage: [
      magic({ byRank: [70, 135, 200, 265] }, [{ stat: 'ap', value: 0.65 }]),
      magic(20, [{ stat: 'ap', value: 0.15 }]),
    ],
  },
  w: {
    id: 'ziggs-w', name: 'Satchel Charge', maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: 65, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 115, 160, 205] }, [{ stat: 'ap', value: 0.5 }])],
  },
  e: {
    id: 'ziggs-e', name: 'Hexplosive Minefield', maxRank: 4, cooldown: 15, cost: { byRank: [70, 80, 90, 100] }, castTime: 0, flags: {},
    // One mine; further mines (40% each) are not modelled.
    damage: [magic({ byRank: [50, 105, 160, 215] }, [{ stat: 'ap', value: 0.35 }])],
  },
  r: {
    id: 'ziggs-r', name: 'Mega Inferno Bomb', maxRank: 3, cooldown: { byRank: [85, 75, 65] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [270, 375, 480] }, [{ stat: 'ap', value: 0.85 }])],
  },
})

const EZREAL = modelled('ezreal', {
  passive: {
    id: 'ezreal-passive', name: 'Rising Spell Force', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'attackStack', id: 'ezreal-passive-rising-spell-force', name: 'Rising Spell Force',
      description: 'Gains 13% Attack Speed for 8 seconds when hitting targets with abilities, stacking up to 4 times.',
      support: 'full',
      stat: 'attackSpeed', amountPerStack: 0.13, stacksFrom: ['ability'], maxStacks: 4, durationSeconds: 8,
    }],
  },
  q: {
    id: 'ezreal-q', name: 'Mystic Shot', maxRank: 4, cooldown: { byRank: [5.5, 5, 4.5, 4] }, cost: { byRank: [30, 35, 40, 45] },
    castTime: 0, flags: {},
    // Applying on-hit effects and the 1.5 second cooldown refund are not modelled.
    damage: [physical({ byRank: [25, 55, 85, 115] }, [{ stat: 'totalAd', value: 1.35 }, { stat: 'ap', value: 0.3 }])],
  },
  w: {
    id: 'ezreal-w', name: 'Essence Flux', maxRank: 4, cooldown: 10, cost: 50, castTime: 0, flags: {},
    // Detonated at once (it needs a follow-up attack or ability hit within 4 seconds).
    damage: [magic({ byRank: [80, 155, 230, 305] }, [
      { stat: 'bonusAd', value: 0.6 }, { stat: 'ap', value: { byRank: [0.75, 0.8, 0.85, 0.9] } },
    ])],
  },
  e: {
    id: 'ezreal-e', name: 'Arcane Shift', maxRank: 4, cooldown: { byRank: [24, 20.5, 17, 13.5] }, cost: 70, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 145, 210, 275] }, [{ stat: 'bonusAd', value: 0.5 }, { stat: 'ap', value: 0.75 }])],
  },
  r: {
    id: 'ezreal-r', name: 'Trueshot Barrage', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [300, 500, 700] }, [{ stat: 'bonusAd', value: 1 }, { stat: 'ap', value: 1 }])],
  },
})

const PYKE = modelled('pyke', {
  passive: {
    id: 'pyke-passive', name: 'Gift of the Drowned Ones', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'statConversion', id: 'pyke-passive-health-to-ad', name: 'Gift of the Drowned Ones',
        description: 'Pyke converts 14 bonus Health to 1 Attack Damage.', support: 'full',
        fromStat: 'hp', fromLayer: 'bonus', toStat: 'ad', ratio: 1 / 14,
      },
      {
        kind: 'statMultiplier', id: 'pyke-passive-no-bonus-health', name: 'Gift of the Drowned Ones (no bonus Health)',
        description: 'Pyke cannot increase his max Health.',
        support: 'partial', supportNotes: 'Bonus Health is removed after it is converted. The stored-damage heal is not modelled.',
        stat: 'hp', layer: 'bonus', amount: -1,
      },
    ],
  },
  q: {
    id: 'pyke-q', name: 'Bone Skewer', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: { byRank: [35, 40, 45, 50] },
    castTime: 0, flags: {},
    damage: [physical({ byRank: [130, 195, 260, 325] }, [{ stat: 'bonusAd', value: 0.6 }])],
  },
  // Ghostwater Dive is camouflage and movement speed.
  w: utility('pyke-w', 'Ghostwater Dive', 4, { byRank: [10.5, 10, 9.5, 9] }, 50),
  e: {
    id: 'pyke-e', name: 'Phantom Undertow', maxRank: 4, cooldown: { byRank: [11, 10.5, 10, 9.5] }, cost: 40, castTime: 0, flags: {},
    damage: [physical({ byRank: [120, 175, 230, 285] }, [{ stat: 'bonusAd', value: 1 }])],
  },
  r: {
    id: 'pyke-r', name: 'Death from Below', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // Only the 50% damage to champions above the threshold. The execute below 250 (+80% bonus AD) (+250% Armor
    // Penetration) Health isn't modelled (the execute effect takes a fraction of max Health), nor the Armor
    // Penetration part (no ratio reads flat Armor Penetration).
    damage: [physical({ byRank: [125, 200, 275] }, [{ stat: 'bonusAd', value: 0.4 }])],
  },
})

/** The eleventh batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH11: Champion[] = [TEEMO, PANTHEON, ZIGGS, EZREAL, PYKE]
