import type { Champion } from '@wr-calc/schema'
import { byLevelLine, magic, modelled, physical, utility } from './champion-helpers'

// Batch 29 (2026-10-02): the last 7 champions without a hand-modelled kit, none of them in the CN pick lists:
// Akshan, Bard, Corki, Gragas, Nilah, Singed and Zoe. Same approach as the earlier batches:
// wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const AKSHAN = modelled('akshan', {
  passive: {
    id: 'akshan-passive', name: 'Dirty Fighting', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'hitStackProc', id: 'akshan-passive-dirty-fighting', name: 'Dirty Fighting',
        description: 'Every three hits from attacks and abilities on the same enemy deal an additional 25 (based on level) '
          + 'magic damage.',
        support: 'partial',
        supportNotes: "25 at every level (the scaling isn't stated); the stack window isn't stated (4 seconds assumed). "
          + 'The shield is not modelled.',
        stacksToProc: 3, stackWindowSeconds: 4, cooldownSeconds: 0, stacksFrom: ['basicAttack', 'ability'],
        damage: magic(25, []), delivery: { kind: 'instant' },
      },
      {
        kind: 'onHit', id: 'akshan-passive-second-shot', name: 'Dirty Fighting (second shot)',
        description: "If Akshan doesn't move after an attack, he fires a second shot that deals 50% AD physical damage.",
        support: 'partial', supportNotes: 'He always stands still; the second shot is folded into the attack.',
        damageType: 'physical', ratios: [{ stat: 'ad', value: 0.5 }],
      },
    ],
  },
  q: {
    id: 'akshan-q', name: 'Avengerang', maxRank: 4, cooldown: { byRank: [8, 7, 6, 5] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    damage: [physical({ byRank: [60, 110, 160, 210] }, [{ stat: 'bonusAd', value: 0.7 }])],
  },
  // Going Rogue is camouflage.
  w: utility('akshan-w', 'Going Rogue', 4, { byRank: [14, 10, 6, 2] }, 30),
  e: {
    id: 'akshan-e', name: 'Heroic Swing', maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: 50, castTime: 0, flags: {},
    // How many shots a swing fires isn't stated (3 assumed); their crits are not modelled.
    damage: [{ ...physical({ byRank: [30, 70, 110, 150] }, [{ stat: 'bonusAd', value: 0.15 }]), hits: 3 }],
  },
  r: {
    id: 'akshan-r', name: 'Comeuppance', maxRank: 3, cooldown: { byRank: [65, 60, 55] }, cost: 100, castTime: 0, flags: {},
    // All shots hit (5/6/7 by rank; the second component is the extra shots). Up to 3x with missing Health, read as a
    // straight line on the base only. The Critical Rate bonus is not modelled.
    damage: [
      { ...physical({ byRank: [25, 35, 45] }, [
        { stat: 'totalAd', value: 0.15 }, { stat: 'targetMissingHpFraction', value: { byRank: [50, 70, 90] } },
      ]), hits: 5 },
      physical({ byRank: [0, 35, 90] }, [
        { stat: 'totalAd', value: { byRank: [0, 0.15, 0.3] } }, { stat: 'targetMissingHpFraction', value: { byRank: [0, 70, 180] } },
      ]),
    ],
  },
})

const BARD = modelled('bard', {
  passive: {
    id: 'bard-passive', name: "Traveler's Call", maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'bard-passive-meep', name: 'Meep',
      description: 'Every 7 seconds a meep empowers his attack to deal 35 (+40% AP) bonus magic damage.',
      support: 'partial', supportNotes: 'No chimes (their +12 per 3 chimes and the slow are not modelled).',
      triggeredBy: ['basicAttack'], damageType: 'magic', damage: 35, ratios: [{ stat: 'ap', value: 0.4 }], cooldownSeconds: 7,
    }],
  },
  q: {
    id: 'bard-q', name: 'Cosmic Binding', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 130, 180, 230] }, [{ stat: 'ap', value: 0.8 }])],
  },
  // Caretaker's Shrine, Magical Journey and Tempered Fate heal, open a corridor and place stasis.
  w: utility('bard-w', "Caretaker's Shrine", 4, { byRank: [15, 14.5, 14, 13.5] }, 70),
  e: utility('bard-e', 'Magical Journey', 4, { byRank: [19, 17.5, 16, 14.5] }, 30),
  r: utility('bard-r', 'Tempered Fate', 3, { byRank: [75, 65, 55] }, 100),
})

const CORKI = modelled('corki', {
  passive: {
    id: 'corki-passive', name: 'Hextech Munitions', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'onHit', id: 'corki-passive-hextech-shrapnel', name: 'Hextech Shrapnel',
      description: 'Attacks deal 16% bonus true damage.',
      support: 'partial', supportNotes: 'Read as 16% AD. The Package is not modelled.',
      damageType: 'true', ratios: [{ stat: 'ad', value: 0.16 }],
    }],
  },
  q: {
    id: 'corki-q', name: 'Phosphorus Bomb', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: { byRank: [60, 65, 70, 75] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 120, 180, 240] }, [{ stat: 'bonusAd', value: 1.1 }, { stat: 'ap', value: 1 }])],
  },
  w: {
    id: 'corki-w', name: 'Valkyrie', maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: { byRank: [80, 85, 90, 95] },
    castTime: 0, flags: {},
    // The trail's listed total (150-450) at once, plus one second's ratios; how the cap and the ratios combine isn't clear.
    damage: [magic({ byRank: [150, 250, 350, 450] }, [{ stat: 'bonusAd', value: 0.6 }, { stat: 'ap', value: 0.6 }])],
  },
  e: {
    ...utility('corki-e', 'Gatling Gun', 4, 12, { byRank: [50, 60, 70, 80] }),
    effects: [{
      kind: 'dot', id: 'corki-e-gatling-gun', name: 'Gatling Gun',
      description: 'Deals 20 (+55% bonus AD) physical damage per second for 4 seconds.',
      support: 'partial', supportNotes: 'The Armor and Magic Resist shred is not modelled.',
      damageType: 'physical', tickAmount: { byRank: [20, 35, 50, 65] }, tickIntervalSeconds: 1, durationSeconds: 4,
      refresh: 'refresh', appliedBy: ['e'], ratios: [{ stat: 'ad', layer: 'bonus', value: 0.55 }],
    }],
  },
  r: {
    id: 'corki-r', name: 'Missile Barrage', maxRank: 3, cooldown: 2, cost: 20, castTime: 0, flags: {},
    // A normal missile; every third (Big One, double damage) and the 4 charges are not modelled.
    damage: [physical({ byRank: [70, 140, 210] }, [{ stat: 'bonusAd', value: 0.65 }])],
  },
})

const GRAGAS = modelled('gragas', {
  // Happy Hour is a heal.
  passive: utility('gragas-passive', 'Happy Hour', 1, null),
  q: {
    id: 'gragas-q', name: 'Barrel Roll', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: { byRank: [65, 70, 75, 80] },
    castTime: 0, flags: {},
    // Fully fermented, read as 150% damage.
    damage: [magic({ byRank: [97.5, 180, 262.5, 345] }, [{ stat: 'ap', value: 1.05 }])],
  },
  w: {
    ...utility('gragas-w', 'Drunken Rage', 4, 5, 20),
    effects: [{
      kind: 'empoweredAttack', id: 'gragas-w-drunken-rage', name: 'Drunken Rage',
      description: "The next attack within 5 seconds deals 35 (+70% AP) plus 8% of the target's max Health as magic damage.",
      support: 'partial', supportNotes: 'The damage reduction is not modelled.',
      grant: { on: 'abilityCast', slots: ['w'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: magic({ byRank: [35, 70, 105, 140] }, [{ stat: 'ap', value: 0.7 }, { stat: 'targetMaxHp', value: 0.08 }]),
    }],
  },
  e: {
    id: 'gragas-e', name: 'Body Slam', maxRank: 4, cooldown: { byRank: [15, 14, 13, 12] }, cost: 50, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 135, 200, 265] }, [{ stat: 'ap', value: 0.7 }])],
  },
  r: {
    id: 'gragas-r', name: 'Explosive Cask', maxRank: 3, cooldown: { byRank: [85, 70, 55] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [200, 300, 400] }, [{ stat: 'ap', value: 0.7 }])],
  },
})

const NILAH = modelled('nilah', {
  // Joy Unending heals on crits.
  passive: utility('nilah-passive', 'Joy Unending', 1, null),
  q: {
    id: 'nilah-q', name: 'Formless Blade', maxRank: 4, cooldown: 4, cost: 30, castTime: 0, flags: {},
    // The +1% per 1% Critical Rate and the Armor Penetration from Critical Rate are not modelled.
    damage: [physical({ byRank: [10, 15, 20, 25] }, [{ stat: 'totalAd', value: { byRank: [0.9, 1, 1.1, 1.2] } }])],
    effects: [{
      kind: 'castBuff', id: 'nilah-q-attack-speed', name: 'Formless Blade',
      description: 'After Formless Blade hits, gains 10% Attack Speed for 4 seconds.',
      support: 'partial', supportNotes: '10% at every level (the scaling is not stated).',
      slots: ['q'], stat: 'attackSpeed', amount: 0.1, durationSeconds: 4, cooldownSeconds: 0,
    }],
  },
  // Jubilant Veil blocks attacks.
  w: utility('nilah-w', 'Jubilant Veil', 4, { byRank: [21, 20, 19, 18] }, { byRank: [45, 30, 15, 0] }),
  e: {
    id: 'nilah-e', name: 'Slipstream', maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: 40, castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 100, 130, 160] }, [{ stat: 'totalAd', value: 0.2 }])],
  },
  r: {
    id: 'nilah-r', name: 'Apotheosis', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, castTime: 0, flags: {},
    // The whirl and the retract, both at once.
    damage: [
      physical({ byRank: [60, 110, 160] }, [{ stat: 'bonusAd', value: 0.5 }]),
      physical({ byRank: [125, 225, 325] }, [{ stat: 'bonusAd', value: 1.2 }]),
    ],
  },
})

const SINGED = modelled('singed', {
  // Noxious Slipstream is movement speed.
  passive: utility('singed-passive', 'Noxious Slipstream', 1, null),
  q: {
    ...utility('singed-q', 'Poison Trail', 4, 1, 12),
    effects: [{
      kind: 'dot', id: 'singed-q-poison-trail', name: 'Poison Trail',
      description: 'Deals 20 (+30% AP) magic damage per second to enemies that touch the trail.',
      support: 'partial', supportNotes: 'Toggled on for 5 seconds per cast, with the target in the trail throughout.',
      damageType: 'magic', tickAmount: { byRank: [20, 28, 36, 44] }, tickIntervalSeconds: 1, durationSeconds: 5,
      refresh: 'refresh', appliedBy: ['q'], ratios: [{ stat: 'ap', value: 0.3 }],
    }],
  },
  w: {
    id: 'singed-w', name: 'Mega Adhesive', maxRank: 4, cooldown: 11, cost: { byRank: [60, 70, 80, 90] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [50, 70, 90, 110] }, [{ stat: 'ap', value: 0.25 }])],
  },
  e: {
    id: 'singed-e', name: 'Fling', maxRank: 4, cooldown: 12, cost: { byRank: [80, 95, 110, 125] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [40, 60, 80, 100] }, [
      { stat: 'ap', value: 0.5 }, { stat: 'targetMaxHp', value: { byRank: [0.05, 0.06, 0.07, 0.08] } },
    ])],
  },
  r: {
    ...utility('singed-r', 'Insanity Potion', 3, { byRank: [70, 65, 60] }, 100),
    effects: (['ap', 'armor', 'mr'] as const).map((stat) => ({
      kind: 'castBuff' as const, id: `singed-r-${stat}`, name: `Insanity Potion (${stat})`,
      description: 'For 20 seconds, grants 30 AP, Armor and Magic Resist.', support: 'full' as const,
      slots: ['r' as const], stat, amount: { byRank: [30, 55, 80] }, durationSeconds: 20, cooldownSeconds: 0,
    })),
  },
})

const ZOE = modelled('zoe', {
  passive: {
    id: 'zoe-passive', name: 'More Sparkles!', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'spellblade', id: 'zoe-passive-more-sparkles', name: 'More Sparkles!',
      description: "After using an ability, Zoe's next attack deals an additional 9-128 (based on level) (+20% AP) magic damage.",
      support: 'partial', supportNotes: 'A straight line from 9 at level 1 to 128 at level 15.',
      damageType: 'magic', bonusDamage: byLevelLine(9, 128), ratios: [{ stat: 'ap', value: 0.2 }], internalCooldownSeconds: 0,
    }],
  },
  q: {
    id: 'zoe-q', name: 'Paddle Star!', maxRank: 4, cooldown: { byRank: [8, 7.5, 7, 6.5] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    // At its longest travel: 2.5x the base and 150% AP.
    damage: [magic({ byRank: [112.5, 200, 287.5, 375] }, [{ stat: 'ap', value: 1.5 }])],
  },
  w: {
    id: 'zoe-w', name: 'Spell Thief', maxRank: 4, cooldown: 0.3, castTime: 0, flags: {},
    // The 3 missiles from casting it (no spell shard is modelled).
    damage: [{ ...magic({ byRank: [25, 35, 45, 55] }, [{ stat: 'ap', value: 0.15 }]), hits: 3 }],
  },
  e: {
    id: 'zoe-e', name: 'Sleepy Trouble Bubble', maxRank: 4, cooldown: { byRank: [15, 14, 13, 12] }, cost: 80, castTime: 0, flags: {},
    // The wake-up bonus true damage is not modelled.
    damage: [magic({ byRank: [40, 90, 140, 190] }, [{ stat: 'ap', value: 0.5 }])],
  },
  // Portal Jump is a blink.
  r: utility('zoe-r', 'Portal Jump', 3, { byRank: [11, 8, 5] }, 50),
})

/** The twenty-ninth batch: the last champions without a hand-modelled kit. */
export const HAND_MODELED_CHAMPIONS_BATCH29: Champion[] = [AKSHAN, BARD, CORKI, GRAGAS, NILAH, SINGED, ZOE]
