import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 24 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Irelia (Baron), Talon (Jungle), Vladimir (Mid) and Janna (Support); every Dragon-lane pick is already modelled. Same
// approach as the earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing
// checked in game yet.

const IRELIA_MAX_FERVOR = 'irelia-ionian-fervor-max'

const IRELIA = modelled('irelia', {
  passive: {
    id: 'irelia-passive', name: 'Ionian Fervor', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'stat', id: 'irelia-passive-attack-speed', name: 'Ionian Fervor (attack speed)',
        description: 'Ability hits grant 3% bonus Attack Speed for 6 seconds, stacking up to 4 times.',
        support: 'partial',
        supportNotes: 'A toggle says whether she is at 4 stacks for the whole combo; 3% per stack at every level.',
        inputs: [{ type: 'boolean', id: IRELIA_MAX_FERVOR, label: 'Irelia: Ionian Fervor at max stacks', default: false }],
        condition: { type: 'toggle', inputId: IRELIA_MAX_FERVOR },
        stat: 'attackSpeed', amount: 0.12,
      },
      {
        kind: 'onHit', id: 'irelia-passive-on-hit', name: 'Ionian Fervor (on-hit)',
        description: 'At max stacks, attacks deal an additional 25 (+30% bonus AD) magic damage on-hit.',
        support: 'partial', supportNotes: 'Uses the same toggle.',
        condition: { type: 'toggle', inputId: IRELIA_MAX_FERVOR },
        damageType: 'magic', flat: 25, ratios: [{ stat: 'ad', layer: 'bonus', value: 0.3 }],
      },
    ],
  },
  q: {
    id: 'irelia-q', name: 'Bladesurge', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: 20, castTime: 0, flags: {},
    // The reset on Marked targets is not modelled.
    damage: [physical({ byRank: [10, 40, 70, 100] }, [{ stat: 'totalAd', value: 0.65 }])],
  },
  w: {
    id: 'irelia-w', name: 'Defiant Dance', maxRank: 4, cooldown: { byRank: [14, 13, 12, 11] }, cost: { byRank: [75, 80, 85, 90] },
    castTime: 0, flags: {},
    // Fully charged (+100%); the charge time itself is not modelled.
    damage: [physical({ byRank: [40, 70, 100, 130] }, [{ stat: 'totalAd', value: 1 }, { stat: 'ap', value: 0.8 }])],
  },
  e: {
    id: 'irelia-e', name: 'Flawless Duet', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: 50, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 130, 180, 230] }, [{ stat: 'ap', value: 0.8 }])],
  },
  r: {
    id: 'irelia-r', name: "Vanguard's Edge", maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    // The storm of blades and the bladewall (the target walks through it), both at once.
    damage: [
      magic({ byRank: [125, 250, 375] }, [{ stat: 'ap', value: 0.7 }]),
      magic({ byRank: [100, 225, 350] }, [{ stat: 'ap', value: 0.7 }]),
    ],
  },
})

const TALON = modelled('talon', {
  passive: {
    id: 'talon-passive', name: "Blade's End", maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'hitStackProc', id: 'talon-passive-bleed', name: "Blade's End",
      description: 'Abilities apply Wound (up to 3). Attacking a target with 3 Wounds makes it bleed for 100 (based on '
        + 'level) (+210% bonus AD) physical damage over 2 seconds.',
      support: 'partial',
      supportNotes: 'The bleed starts on the third ability hit rather than the next attack. 100 at every level (the '
        + 'scaling is not stated); four half-second ticks.',
      stacksToProc: 3, stackWindowSeconds: 6, cooldownSeconds: 2, stacksFrom: ['ability'],
      damage: physical(25, [{ stat: 'bonusAd', value: 0.525 }]),
      delivery: { kind: 'dot', tickIntervalSeconds: 0.5, durationSeconds: 2 },
    }],
  },
  q: {
    id: 'talon-q', name: 'Noxian Diplomacy', maxRank: 4, cooldown: { byRank: [7, 6.5, 6, 5.5] }, cost: 40, castTime: 0, flags: {},
    // The close-range stab; its crit scaling is not modelled.
    damage: [physical({ byRank: [113, 150, 188, 225] }, [{ stat: 'bonusAd', value: 1.5 }])],
  },
  w: {
    id: 'talon-w', name: 'Rake', maxRank: 4, cooldown: { byRank: [8, 7.5, 7, 6.5] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    // Out and back, both at once.
    damage: [
      physical({ byRank: [40, 50, 60, 70] }, [{ stat: 'bonusAd', value: 0.5 }]),
      physical({ byRank: [60, 100, 140, 180] }, [{ stat: 'bonusAd', value: 1 }]),
    ],
  },
  // Assassin's Path is a vault.
  e: utility('talon-e', "Assassin's Path", 4, 1),
  r: {
    id: 'talon-r', name: 'Shadow Assault', maxRank: 3, cooldown: { byRank: [65, 55, 45] }, cost: 100, castTime: 0, flags: {},
    // The ring and its return, both at once.
    damage: [{ ...physical({ byRank: [90, 135, 180] }, [{ stat: 'bonusAd', value: 1.1 }]), hits: 2 }],
  },
})

const VLADIMIR = modelled('vladimir', {
  passive: {
    id: 'vladimir-passive', name: 'Crimson Pact', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'statConversion', id: 'vladimir-passive-health-to-ap', name: 'Crimson Pact (AP)',
        description: 'Gains Ability Power equal to 5% of bonus Health.', support: 'full',
        fromStat: 'hp', fromLayer: 'bonus', toStat: 'ap', ratio: 0.05,
      },
      {
        kind: 'statConversion', id: 'vladimir-passive-ap-to-health', name: 'Crimson Pact (Health)',
        description: 'Gains bonus Health equal to 150% of Ability Power.', support: 'full',
        fromStat: 'ap', toStat: 'hp', ratio: 1.5,
      },
    ],
  },
  q: {
    id: 'vladimir-q', name: 'Transfusion', maxRank: 4, cooldown: { byRank: [9, 7.5, 6, 4.5] }, castTime: 0, flags: {},
    // The un-empowered cast (Crimson Rush's +85% is not modelled).
    damage: [magic({ byRank: [70, 100, 130, 160] }, [{ stat: 'ap', value: 0.6 }])],
  },
  w: {
    ...utility('vladimir-w', 'Sanguine Pool', 4, { byRank: [25, 22, 19, 16] }),
    effects: [{
      kind: 'dot', id: 'vladimir-w-pool', name: 'Sanguine Pool',
      description: 'Enemies within the pool take 20 (+2% of max Health) magic damage every 0.5 seconds for 2 seconds.',
      support: 'partial', supportNotes: 'The target stays in the pool; the Health cost is not modelled.',
      damageType: 'magic', tickAmount: { byRank: [20, 40, 60, 80] }, tickIntervalSeconds: 0.5, durationSeconds: 2,
      refresh: 'refresh', appliedBy: ['w'], ratios: [{ stat: 'hp', value: 0.02 }],
    }],
  },
  e: {
    id: 'vladimir-e', name: 'Tides of Blood', maxRank: 4, cooldown: { byRank: [12.5, 10, 7.5, 5] }, castTime: 0, flags: {},
    // Fully charged (+100%); the charge time and the Health cost are not modelled.
    damage: [magic({ byRank: [60, 100, 140, 180] }, [{ stat: 'ap', value: 0.7 }, { stat: 'maxHp', value: 0.06 }])],
  },
  r: {
    id: 'vladimir-r', name: 'Hemoplague', maxRank: 3, cooldown: 90, castTime: 0, flags: {},
    // Dealt at once (the 4 second delay and the 10% of damage taken are not modelled).
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.7 }])],
  },
})

const JANNA = modelled('janna', {
  // Tailwind is movement speed.
  passive: utility('janna-passive', 'Tailwind', 1, null),
  q: {
    id: 'janna-q', name: 'Howling Gale', maxRank: 4, cooldown: 1, cost: 50, castTime: 0, flags: {},
    // One whirlwind; the 2 charges (14 seconds each) are not modelled.
    damage: [magic({ byRank: [50, 90, 130, 170] }, [{ stat: 'ap', value: 0.5 }])],
  },
  w: {
    id: 'janna-w', name: 'Zephyr', maxRank: 4, cooldown: { byRank: [9, 8.5, 8, 7.5] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    // The +20% bonus Movement Speed ratio is not modelled.
    damage: [magic({ byRank: [50, 90, 130, 170] }, [{ stat: 'ap', value: 0.5 }])],
  },
  // Eye of the Storm shields; Monsoon heals and knocks back.
  e: utility('janna-e', 'Eye of the Storm', 4, { byRank: [16, 14, 12, 10] }, { byRank: [70, 80, 90, 100] }),
  r: utility('janna-r', 'Monsoon', 3, { byRank: [80, 75, 70] }, 100),
})

/** The twenty-fourth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH24: Champion[] = [IRELIA, TALON, VLADIMIR, JANNA]
