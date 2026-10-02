import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 19 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Jayce (Baron), Warwick (Jungle), Orianna (Mid), Sivir (Dragon) and Nami (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const JAYCE = modelled('jayce', {
  // Hextech Capacitor is movement speed.
  passive: utility('jayce-passive', 'Hextech Capacitor', 1, null),
  // Mercury Hammer stance only (he starts in it; attack-types.ts lists him as melee). Q, W and E have 5 ranks.
  q: {
    id: 'jayce-q', name: 'To the Skies!', maxRank: 5, cooldown: { byRank: [14, 12, 10, 8, 6] }, cost: 40, castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 120, 170, 220, 270] }, [{ stat: 'bonusAd', value: 1.4 }])],
  },
  w: {
    ...utility('jayce-w', 'Lightning Field', 5, 10, 40),
    effects: [{
      kind: 'dot', id: 'jayce-w-lightning-field', name: 'Lightning Field',
      description: 'Releases an electrifying aura, dealing 160 (+100% AP) magic damage over 4 seconds to nearby enemies.',
      support: 'partial', supportNotes: 'Split into 4 one-second ticks; the target stays in range. The Mana restore is not modelled.',
      damageType: 'magic', tickAmount: { byRank: [40, 57.5, 75, 92.5, 110] }, tickIntervalSeconds: 1, durationSeconds: 4,
      refresh: 'refresh', appliedBy: ['w'], ratios: [{ stat: 'ap', value: 0.25 }],
    }],
  },
  e: {
    id: 'jayce-e', name: 'Thundering Blow', maxRank: 5, cooldown: { byRank: [18, 16, 14, 12, 10] }, cost: 50, castTime: 0, flags: {},
    damage: [magic(0, [
      { stat: 'targetMaxHp', value: { byRank: [0.1, 0.125, 0.15, 0.175, 0.2] } }, { stat: 'bonusAd', value: 1 },
    ])],
  },
  // Transform swaps to the Mercury Cannon; its stance bonuses and empowered attacks are not modelled.
  r: utility('jayce-r', 'Transform', 1, 5),
})

const WARWICK = modelled('warwick', {
  passive: {
    id: 'warwick-passive', name: 'Eternal Hunger', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'onHit', id: 'warwick-passive-eternal-hunger', name: 'Eternal Hunger',
      description: 'Attacks deal an additional 12 (+15% bonus AD +10% AP) magic damage on hit.',
      support: 'partial', supportNotes: 'The heal below 50% Health is not modelled.',
      damageType: 'magic', flat: 12, ratios: [{ stat: 'ad', layer: 'bonus', value: 0.15 }, { stat: 'ap', value: 0.1 }],
    }],
  },
  q: {
    id: 'warwick-q', name: 'Jaws of the Beast', maxRank: 4, cooldown: 6, cost: 40, castTime: 0, flags: { appliesOnHit: true },
    // The calculator doesn't apply on-hit effects from abilities yet, so Eternal Hunger isn't added to the bite.
    damage: [magic(0, [
      { stat: 'totalAd', value: 1.2 }, { stat: 'ap', value: 0.85 },
      { stat: 'targetMaxHp', value: { byRank: [0.06, 0.07, 0.08, 0.09] } },
    ])],
  },
  // Blood Hunt's attack speed against targets below 50% Health is not modelled.
  w: utility('warwick-w', 'Blood Hunt', 4, { byRank: [70, 60, 50, 40] }, 70),
  // Primal Howl is damage reduction and a fear.
  e: utility('warwick-e', 'Primal Howl', 4, { byRank: [14, 13, 12, 11] }, 30),
  r: {
    id: 'warwick-r', name: 'Infinite Duress', maxRank: 3, cooldown: { byRank: [100, 90, 80] }, cost: 100, castTime: 0, flags: {},
    // The whole suppression at once; its 4 on-hit applications are not modelled.
    damage: [magic({ byRank: [100, 275, 450] }, [{ stat: 'bonusAd', value: 1.67 }])],
  },
})

const ORIANNA = modelled('orianna', {
  passive: {
    id: 'orianna-passive', name: 'Clockwork Windup', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'onHit', id: 'orianna-passive-clockwork-windup', name: 'Clockwork Windup',
      description: 'Attacks deal 13 (+15% AP) bonus magic damage.',
      support: 'partial',
      supportNotes: 'Flat 13 at every level (scaling not stated). The up-to-2 stacks on the same target are not modelled.',
      damageType: 'magic', flat: 13, ratios: [{ stat: 'ap', value: 0.15 }],
    }],
  },
  q: {
    id: 'orianna-q', name: 'Command: Attack', maxRank: 4, cooldown: { byRank: [7.5, 6, 4.5, 3] }, cost: { byRank: [30, 35, 40, 45] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 105, 150, 195] }, [{ stat: 'ap', value: 0.45 }])],
  },
  w: {
    id: 'orianna-w', name: 'Command: Dissonance', maxRank: 4, cooldown: 7, cost: { byRank: [70, 80, 90, 100] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 110, 160, 210] }, [{ stat: 'ap', value: 0.7 }])],
  },
  e: {
    id: 'orianna-e', name: 'Command: Protect', maxRank: 4, cooldown: 9, cost: 60, castTime: 0, flags: {},
    // The Ball passes through the target on its way to an ally.
    damage: [magic({ byRank: [50, 90, 130, 170] }, [{ stat: 'ap', value: 0.3 }])],
  },
  r: {
    id: 'orianna-r', name: 'Command: Shockwave', maxRank: 3, cooldown: { byRank: [75, 65, 55] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [250, 350, 450] }, [{ stat: 'ap', value: 0.85 }])],
  },
})

const SIVIR = modelled('sivir', {
  // Fleet of Foot is movement speed.
  passive: utility('sivir-passive', 'Fleet of Foot', 1, null),
  q: {
    id: 'sivir-q', name: 'Boomerang Blade', maxRank: 4, cooldown: { byRank: [9.5, 9, 8.5, 8] }, cost: { byRank: [55, 60, 65, 70] },
    castTime: 0, flags: {},
    // Out and back through the target. The crit scaling (40% effectiveness) is not modelled.
    damage: [{ ...physical({ byRank: [70, 100, 130, 160] }, [{ stat: 'bonusAd', value: 0.7 }, { stat: 'ap', value: 0.6 }]), hits: 2 }],
  },
  w: {
    ...utility('sivir-w', 'Ricochet', 4, 12, 60),
    effects: [{
      kind: 'castBuff', id: 'sivir-w-attack-speed', name: 'Ricochet',
      description: 'Gains 25% Attack Speed for 4 seconds.',
      support: 'partial', supportNotes: 'The bounces need a second enemy; one target takes nothing extra.',
      slots: ['w'], stat: 'attackSpeed', amount: { byRank: [0.25, 0.3, 0.35, 0.4] }, durationSeconds: 4, cooldownSeconds: 0,
    }],
  },
  // Spell Shield blocks an ability and heals.
  e: utility('sivir-e', 'Spell Shield', 4, { byRank: [22, 20, 18, 16] }),
  // On the Hunt's Morale (Attack Damage per hit) and cooldown reduction are not modelled.
  r: utility('sivir-r', 'On the Hunt', 3, { byRank: [80, 70, 60] }, 100),
})

const NAMI = modelled('nami', {
  // Surging Tides is movement speed for allies.
  passive: utility('nami-passive', 'Surging Tides', 1, null),
  q: {
    id: 'nami-q', name: 'Aqua Prison', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [75, 145, 215, 285] }, [{ stat: 'ap', value: 0.5 }])],
  },
  w: {
    id: 'nami-w', name: 'Ebb and Flow', maxRank: 4, cooldown: 10, cost: { byRank: [70, 85, 100, 115] }, castTime: 0, flags: {},
    // The first bounce hits the target (each target is hit once).
    damage: [magic({ byRank: [65, 120, 175, 230] }, [{ stat: 'ap', value: 0.5 }])],
  },
  e: {
    ...utility('nami-e', "Tidecaller's Blessing", 4, 11, { byRank: [55, 60, 65, 70] }),
    effects: [{
      kind: 'empoweredAttack', id: 'nami-e-blessing', name: "Tidecaller's Blessing",
      description: "Empowers an allied champion's next 3 attacks for 6 seconds to deal an additional 25 (+20% AP) magic damage.",
      support: 'partial', supportNotes: 'Cast on herself. The slow is not modelled.',
      grant: { on: 'abilityCast', slots: ['e'], charges: 3 }, maxCharges: 3, durationSeconds: 6,
      bonus: magic({ byRank: [25, 45, 65, 85] }, [{ stat: 'ap', value: 0.2 }]),
    }],
  },
  r: {
    id: 'nami-r', name: 'Tidal Wave', maxRank: 3, cooldown: { byRank: [75, 70, 65] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.6 }])],
  },
})

/** The nineteenth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH19: Champion[] = [JAYCE, WARWICK, ORIANNA, SIVIR, NAMI]
