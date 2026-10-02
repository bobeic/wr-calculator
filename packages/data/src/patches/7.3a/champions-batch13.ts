import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 13 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Renekton (Baron), Shyvana (Jungle), Syndra (Mid), Twitch (Dragon) and Swain (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const RENEKTON = modelled('renekton', {
  // Reign of Anger (Fury-empowered casts) is not modelled: every ability below is its un-empowered version.
  passive: utility('renekton-passive', 'Reign of Anger', 1, null),
  q: {
    id: 'renekton-q', name: 'Cull the Meek', maxRank: 4, cooldown: 7, castTime: 0, flags: {},
    damage: [physical({ byRank: [80, 130, 180, 230] }, [{ stat: 'bonusAd', value: 1 }])],
  },
  w: {
    ...utility('renekton-w', 'Ruthless Predator', 4, { byRank: [14, 12, 10, 8] }),
    effects: [{
      kind: 'empoweredAttack', id: 'renekton-w-ruthless-predator', name: 'Ruthless Predator',
      description: 'Empowers the next attack to strike twice, stunning for 0.75 seconds and dealing 20 (+150% AD) '
        + 'physical damage.',
      support: 'partial',
      supportNotes: 'Read as the two strikes together dealing 20 (+150% AD), i.e. the attack plus 20 (+50% AD). How '
        + 'long the empower lasts unused is not stated (5s assumed).',
      grant: { on: 'abilityCast', slots: ['w'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: physical({ byRank: [20, 60, 100, 140] }, [{ stat: 'totalAd', value: 0.5 }]),
    }],
  },
  e: {
    id: 'renekton-e', name: 'Slice and Dice', maxRank: 4, cooldown: { byRank: [14.5, 13, 11.5, 10] }, castTime: 0, flags: {},
    // The dash and its recast, both at once.
    damage: [{ ...physical({ byRank: [40, 80, 120, 160] }, [{ stat: 'bonusAd', value: 0.9 }]), hits: 2 }],
  },
  r: {
    id: 'renekton-r', name: 'Dominus', maxRank: 3, cooldown: { byRank: [75, 70, 65] }, castTime: 0, flags: {},
    // The first second; the dot below deals the other 11.
    damage: [magic({ byRank: [70, 120, 170] }, [{ stat: 'ap', value: 0.2 }])],
    effects: [{
      kind: 'dot', id: 'renekton-r-dominus', name: 'Dominus',
      description: 'For 12 seconds, deals 70 (+20% AP) magic damage to nearby enemies every second.',
      support: 'partial', supportNotes: 'The target stays nearby for all 12 seconds. The Health gain is not modelled.',
      damageType: 'magic', tickAmount: { byRank: [70, 120, 170] }, tickIntervalSeconds: 1, durationSeconds: 11,
      refresh: 'refresh', appliedBy: ['r'], ratios: [{ stat: 'ap', value: 0.2 }],
    }],
  },
})

const SHYVANA = modelled('shyvana', {
  // Fury of the Dragonborn's stacks come from monsters and takedowns. Dragon Form is not modelled anywhere here.
  passive: utility('shyvana-passive', 'Fury of the Dragonborn', 1, null),
  q: {
    ...utility('shyvana-q', 'Twin Bite', 4, { byRank: [8.5, 7.5, 6.5, 5.5] }),
    effects: [{
      kind: 'empoweredAttack', id: 'shyvana-q-twin-bite', name: 'Twin Bite',
      description: "Empowers Shyvana's next attack to strike twice, dealing 100% AD and 20% AD physical damage.",
      support: 'partial',
      supportNotes: 'The cooldown cut from attacks is not modelled. How long the empower lasts unused is not stated '
        + '(5s assumed).',
      grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: physical(0, [{ stat: 'totalAd', value: { byRank: [0.2, 0.4, 0.6, 0.8] } }]),
    }],
  },
  w: {
    id: 'shyvana-w', name: 'Burnout', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, castTime: 0, flags: {},
    // The first second; the dot below deals the other 2.
    damage: [magic({ byRank: [35, 50, 65, 80] }, [{ stat: 'bonusAd', value: 0.3 }])],
    effects: [{
      kind: 'dot', id: 'shyvana-w-burnout', name: 'Burnout',
      description: 'Deals 35 (+30% bonus AD) magic damage per second to nearby enemies. Attacking extends the duration '
        + 'by up to 4 seconds.',
      support: 'partial', supportNotes: '3 seconds (the base duration); the extension from attacks is not modelled.',
      damageType: 'magic', tickAmount: { byRank: [35, 50, 65, 80] }, tickIntervalSeconds: 1, durationSeconds: 2,
      refresh: 'refresh', appliedBy: ['w'], ratios: [{ stat: 'ad', layer: 'bonus', value: 0.3 }],
    }],
  },
  e: {
    id: 'shyvana-e', name: 'Flame Breath', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 110, 160, 210] }, [{ stat: 'totalAd', value: 0.3 }, { stat: 'ap', value: 0.4 }])],
    effects: [{
      kind: 'empoweredAttack', id: 'shyvana-e-scorch', name: 'Scorch',
      description: "Scorches the target for 5 seconds. Shyvana's attacks on Scorched enemies deal bonus magic damage equal "
        + 'to 3% of their max Health.',
      support: 'full',
      grant: { on: 'abilityCast', slots: ['e'], charges: 99 }, maxCharges: 99, durationSeconds: 5,
      bonus: magic(0, [{ stat: 'targetMaxHp', value: 0.03 }]),
    }],
  },
  r: {
    id: 'shyvana-r', name: "Dragon's Descent", maxRank: 3, cooldown: 1, cost: 100, castTime: 0, flags: {},
    // Needs 100 Fury (the cost); Dragon Form's Health and empowered abilities are not modelled.
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.8 }])],
  },
})

const SYNDRA = modelled('syndra', {
  // Transcendent's empowered abilities and 12% AP need Splinters of Wrath; not modelled.
  passive: utility('syndra-passive', 'Transcendent', 1, null),
  q: {
    id: 'syndra-q', name: 'Dark Sphere', maxRank: 4, cooldown: { byRank: [7, 6.5, 6, 5.5] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 130, 180, 230] }, [{ stat: 'ap', value: 0.65 }])],
  },
  w: {
    id: 'syndra-w', name: 'Force of Will', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: { byRank: [70, 80, 90, 100] },
    castTime: 0, flags: {},
    // Hurling an existing sphere (full damage).
    damage: [magic({ byRank: [60, 100, 140, 180] }, [{ stat: 'ap', value: 0.5 }])],
  },
  e: {
    id: 'syndra-e', name: 'Scatter the Weak', maxRank: 4, cooldown: 15, cost: 50, castTime: 0, flags: {},
    // Enemies take damage once per cast.
    damage: [magic({ byRank: [70, 110, 150, 190] }, [{ stat: 'ap', value: 0.5 }])],
  },
  r: {
    id: 'syndra-r', name: 'Unleashed Power', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // The 3 orbiting spheres; up to 4 more nearby are not counted.
    damage: [{ ...magic({ byRank: [60, 110, 160] }, [{ stat: 'ap', value: 0.15 }]), hits: 3 }],
  },
})

const TWITCH = modelled('twitch', {
  passive: {
    id: 'twitch-passive', name: 'Deadly Venom', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'dot', id: 'twitch-passive-deadly-venom', name: 'Deadly Venom',
      description: 'Attacks apply a stack of Deadly Venom, dealing 1 (based on level) (+3% AP) true damage over 5 '
        + 'seconds and stacking up to 5 times.',
      support: 'partial',
      supportNotes: 'Read as 1 (+3% AP) per second per stack (League of Legends\' wording); "over 5 seconds" may mean '
        + 'in total. Any level scaling is not stated, so 1 is used at every level.',
      damageType: 'true', tickAmount: 1, tickIntervalSeconds: 1, durationSeconds: 5, refresh: 'stack', maxStacks: 5,
      appliedBy: ['basicAttack'], ratios: [{ stat: 'ap', value: 0.03 }],
    }],
  },
  q: {
    ...utility('twitch-q', 'Ambush', 4, 15, 40),
    effects: [{
      kind: 'castBuff', id: 'twitch-q-ambush', name: 'Ambush',
      description: 'After exiting camouflage, gains 35% bonus Attack Speed for 6 seconds.',
      support: 'partial', supportNotes: 'The buff starts at the cast (the camouflage before it is not modelled).',
      slots: ['q'], stat: 'attackSpeed', amount: { byRank: [0.35, 0.4, 0.45, 0.5] }, durationSeconds: 6, cooldownSeconds: 0,
    }],
  },
  // Venom Cask applies venom stacks; not modelled.
  w: utility('twitch-w', 'Venom Cask', 4, { byRank: [12, 11, 10, 9] }, 70),
  e: {
    id: 'twitch-e', name: 'Contaminate', maxRank: 4, cooldown: { byRank: [16, 15, 14, 13] }, cost: { byRank: [35, 45, 55, 65] },
    castTime: 0, flags: {},
    // Against a target with max (5) Deadly Venom stacks: 30 + 5 x (20 (+35% bonus AD)) physical and 5 x 35% AP magic.
    damage: [
      physical({ byRank: [130, 165, 200, 235] }, [{ stat: 'bonusAd', value: 1.75 }]),
      magic(0, [{ stat: 'ap', value: 1.75 }]),
    ],
  },
  r: {
    ...utility('twitch-r', 'Spray and Pray', 3, { byRank: [75, 70, 65] }, 100),
    effects: [{
      kind: 'castBuff', id: 'twitch-r-spray-and-pray', name: 'Spray and Pray',
      description: 'For 6 seconds, gains 225 Attack Range and 30 bonus Attack Damage.', support: 'full',
      slots: ['r'], stat: 'ad', amount: { byRank: [30, 45, 60] }, durationSeconds: 6, cooldownSeconds: 0,
    }],
  },
})

const SWAIN = modelled('swain', {
  // Ravenous Flock's Soul Fragments heal and add Health.
  passive: utility('swain-passive', 'Ravenous Flock', 1, null),
  q: {
    id: 'swain-q', name: "Death's Hand", maxRank: 4, cooldown: { byRank: [6, 5, 4, 3] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    // All 5 bolts on the target (League of Legends' count; the text doesn't give one). "Up to 95 damage" is not applied.
    damage: [
      magic({ byRank: [55, 90, 125, 160] }, [{ stat: 'ap', value: 0.32 }]),
      { ...magic({ byRank: [10, 20, 30, 40] }, [{ stat: 'ap', value: 0.12 }]), hits: 4 },
    ],
  },
  w: {
    id: 'swain-w', name: 'Vision of Empire', maxRank: 4, cooldown: { byRank: [21, 20, 19, 18] }, cost: { byRank: [65, 70, 75, 80] },
    castTime: 0, flags: {},
    // The crit on an immobilized champion is not modelled.
    damage: [magic({ byRank: [80, 130, 180, 230] }, [{ stat: 'ap', value: 0.55 }])],
  },
  e: {
    id: 'swain-e', name: 'Nevermove', maxRank: 4, cooldown: 10, cost: 60, castTime: 0, flags: {},
    // Out and back, both at once.
    damage: [
      magic({ byRank: [35, 85, 135, 185] }, [{ stat: 'ap', value: 0.25 }]),
      magic({ byRank: [35, 50, 65, 80] }, [{ stat: 'ap', value: 0.4 }]),
    ],
  },
  r: {
    id: 'swain-r', name: 'Demonic Ascension', maxRank: 3, cooldown: { byRank: [75, 65, 55] }, cost: 100, castTime: 0, flags: {},
    // The recast's burst folded into the cast; the aura is the dot below.
    damage: [magic(150, [{ stat: 'ap', value: 0.45 }])],
    effects: [{
      kind: 'dot', id: 'swain-r-aura', name: 'Demonic Ascension (aura)',
      description: 'Deals 15 (+6% AP) magic damage per second to enemies within his range while transformed.',
      support: 'partial',
      supportNotes: "How long the form lasts depends on Demonic Energy; 6 seconds is assumed. The heal is not modelled.",
      damageType: 'magic', tickAmount: { byRank: [15, 25, 35] }, tickIntervalSeconds: 1, durationSeconds: 6,
      refresh: 'refresh', appliedBy: ['r'], ratios: [{ stat: 'ap', value: 0.06 }],
    }],
  },
})

/** The thirteenth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH13: Champion[] = [RENEKTON, SHYVANA, SYNDRA, TWITCH, SWAIN]
