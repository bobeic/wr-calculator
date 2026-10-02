import type { Champion, DamageComponent } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 15 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Fiora (Baron), Wukong (Jungle), Twisted Fate (Mid), Smolder (Dragon) and Soraka (Support). Same approach as the
// earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const SMOLDER_STACKS = 'smolder-dragon-practice-stacks'

/** Smolder's "N% Passive" magic damage: N% of his Dragon Practice stacks. */
const smolderPassive = (fraction: number): DamageComponent => ({ ...magic(0, []), basePerInput: { inputId: SMOLDER_STACKS, value: fraction } })

const FIORA = modelled('fiora', {
  passive: {
    id: 'fiora-passive', name: "Duelist's Dance", maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'fiora-passive-vital', name: 'Vital',
      description: "Striking a Vital deals 4% (+0.055% per bonus AD) of the target's max Health as true damage. A new "
        + 'Vital is revealed 2 seconds after striking one.',
      support: 'partial',
      supportNotes: 'She is assumed to strike every Vital as soon as it appears (every 2 seconds, with an attack or '
        + 'Lunge). The +0.055% per bonus AD, the heal and the movement speed are not modelled.',
      triggeredBy: ['basicAttack', 'ability'], damageType: 'true', damage: 0, ratios: [], pctTargetMaxHp: 0.04, cooldownSeconds: 2,
    }],
  },
  q: {
    id: 'fiora-q', name: 'Lunge', maxRank: 4, cooldown: { byRank: [12, 10, 8, 6] }, cost: { byRank: [20, 25, 30, 35] },
    castTime: 0, flags: {},
    // On-hit effects and the 50% cooldown refund on a hit are not modelled.
    damage: [physical({ byRank: [75, 85, 95, 105] }, [{ stat: 'bonusAd', value: { byRank: [1.1, 1.15, 1.2, 1.25] } }])],
  },
  w: {
    id: 'fiora-w', name: 'Riposte', maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: 50, castTime: 0, flags: {},
    damage: [magic({ byRank: [120, 170, 220, 270] }, [{ stat: 'ap', value: 1 }])],
  },
  e: {
    ...utility('fiora-e', 'Bladework', 4, { byRank: [11, 9, 7, 5] }, { byRank: [30, 35, 40, 45] }),
    effects: [{
      kind: 'empoweredAttack', id: 'fiora-e-bladework', name: 'Bladework',
      description: 'Empowers the next 2 attacks with 60% bonus Attack Speed. The second attack always critically '
        + 'strikes for 170% physical damage.',
      support: 'partial',
      supportNotes: "The second attack's crit (+70-100% AD) is split evenly over both attacks. The slow is not modelled. "
        + 'How long the empower lasts unused is not stated (5s assumed).',
      grant: { on: 'abilityCast', slots: ['e'], charges: 2 }, maxCharges: 2, durationSeconds: 5, attackSpeedBonus: 0.6,
      bonus: physical(0, [{ stat: 'totalAd', value: { byRank: [0.35, 0.4, 0.45, 0.5] } }]),
    }],
  },
  r: {
    id: 'fiora-r', name: 'Grand Challenge', maxRank: 3, cooldown: { byRank: [70, 60, 50] }, cost: 100, castTime: 0, flags: {},
    // Striking all 4 Vitals, at once: their 16% max Health true damage. The 4 Vitals' own 4% each, and the heal, are
    // not modelled.
    damage: [{ type: 'true', base: 0, ratios: [{ stat: 'targetMaxHp', value: 0.16 }], tags: [] }],
  },
})

const WUKONG = modelled('wukong', {
  // Crushing Blows' Stone Skin is Armor and healing.
  passive: utility('wukong-passive', 'Crushing Blows', 1, null),
  q: {
    ...utility('wukong-q', 'Golden Staff', 4, { byRank: [8, 7.5, 7, 6.5] }, 30),
    effects: [{
      kind: 'empoweredAttack', id: 'wukong-q-golden-staff', name: 'Golden Staff',
      description: 'Empowers the next attack to deal 60 (+35% AD) bonus physical damage.',
      support: 'partial',
      supportNotes: "The passive's +50% every 10.5-6 seconds and the cooldown cut from attacks are not modelled. How "
        + 'long the empower lasts unused is not stated (5s assumed).',
      grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: physical({ byRank: [60, 90, 120, 150] }, [{ stat: 'totalAd', value: { byRank: [0.35, 0.4, 0.45, 0.5] } }]),
    }],
  },
  // Warrior Trickster's clone (20-50% of Wukong's damage) is not modelled.
  w: utility('wukong-w', 'Warrior Trickster', 4, { byRank: [14, 13.5, 13, 12.5] }, { byRank: [55, 60, 65, 70] }),
  e: {
    id: 'wukong-e', name: 'Nimbus Strike', maxRank: 4, cooldown: 8, cost: 40, castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 110, 150, 190] }, [{ stat: 'bonusAd', value: 0.8 }])],
    effects: [{
      kind: 'castBuff', id: 'wukong-e-attack-speed', name: 'Nimbus Strike',
      description: 'After hitting the targeted enemy, Wukong gains 25% Attack Speed for 4 seconds.', support: 'full',
      slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.25, 0.35, 0.45, 0.55] }, durationSeconds: 4, cooldownSeconds: 0,
    }],
  },
  r: {
    id: 'wukong-r', name: 'Cyclone', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // Both spins (the recast within 8 seconds), each with its 2 seconds of damage at once.
    damage: [{ ...physical(0, [{ stat: 'totalAd', value: 2.2 }, { stat: 'targetMaxHp', value: { byRank: [0.1, 0.14, 0.18] } }]), hits: 2 }],
  },
})

const TWISTED_FATE = modelled('twisted-fate', {
  // Loaded Dice is gold.
  passive: utility('twisted-fate-passive', 'Loaded Dice', 1, null),
  q: {
    id: 'twisted-fate-q', name: 'Wild Cards', maxRank: 4, cooldown: 6, cost: { byRank: [60, 70, 80, 90] }, castTime: 0, flags: {},
    // One card hits the target.
    damage: [magic({ byRank: [60, 120, 180, 240] }, [{ stat: 'ap', value: 0.7 }])],
  },
  w: {
    ...utility('twisted-fate-w', 'Pick a Card', 4, { byRank: [7, 6.5, 6, 5.5] }, { byRank: [40, 60, 80, 100] }),
    effects: [{
      kind: 'empoweredAttack', id: 'twisted-fate-w-blue-card', name: 'Pick a Card (Blue Card)',
      description: 'Blue Cards deal 40 (+75% AP +100% AD) magic damage and restore 60 Mana.',
      support: 'partial',
      supportNotes: "The Blue Card (the most damage); the shuffle before picking is not modelled. The card's 100% AD "
        + 'stays the attack\'s physical damage; the rest is added as magic. How long the card lasts unused is not '
        + 'stated (5s assumed).',
      grant: { on: 'abilityCast', slots: ['w'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: magic({ byRank: [40, 65, 90, 115] }, [{ stat: 'ap', value: 0.75 }]),
    }],
  },
  e: {
    ...utility('twisted-fate-e', 'Stacked Deck', 4, { byRank: [17, 16, 15, 14] }, 50),
    effects: [
      {
        kind: 'stat', id: 'twisted-fate-e-passive-attack-speed', name: 'Stacked Deck (passive)',
        description: 'Gains 15% Attack Speed.', support: 'full',
        stat: 'attackSpeed', amount: { byRank: [0.15, 0.2, 0.25, 0.3] },
      },
      {
        kind: 'procEveryN', id: 'twisted-fate-e-fourth-attack', name: 'Stacked Deck (4th attack)',
        description: 'Every 4th attack deals 50 (+35% AP) bonus magic damage.', support: 'full',
        n: 4, countsFrom: 'basicAttack', damageType: 'magic', damage: { byRank: [50, 80, 110, 140] },
        ratios: [{ stat: 'ap', value: 0.35 }], resetsOnMiss: false,
      },
      {
        kind: 'castBuff', id: 'twisted-fate-e-active', name: 'Stacked Deck',
        description: 'Gains 20% Attack Speed for 3 seconds.', support: 'full',
        slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.2, 0.25, 0.3, 0.35] }, durationSeconds: 3, cooldownSeconds: 0,
      },
    ],
  },
  // Destiny reveals and teleports.
  r: utility('twisted-fate-r', 'Destiny', 3, { byRank: [100, 90, 80] }, 100),
})

const SMOLDER = modelled('smolder', {
  passive: {
    id: 'smolder-passive', name: 'Dragon Practice', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'stacking', id: 'smolder-passive-stacks', name: 'Dragon Practice',
      description: 'Hitting enemy champions with abilities grants a stack of Dragon Practice, which improves '
        + "Smolder's basic abilities (\"N% Passive\" magic damage is N% of his stacks).",
      support: 'partial',
      supportNotes: 'Only the input, read by his abilities; it grants no stat. The effects unlocked at 25, 100 and 175 '
        + "stacks, and Flap, Flap, Flap's extra bolt every 65, are not modelled.",
      inputs: [{ type: 'stackCount', id: SMOLDER_STACKS, label: 'Smolder: Dragon Practice stacks', min: 0, max: 500, default: 0 }],
      stat: 'ad', perStack: 0, maxStacks: 500, stackInputId: SMOLDER_STACKS,
    }],
  },
  q: {
    id: 'smolder-q', name: 'Super Scorcher Breath', maxRank: 4, cooldown: { byRank: [5.5, 5, 4.5, 4] }, cost: 30, castTime: 0, flags: {},
    // The scaling with crit rate and crit damage is not modelled.
    damage: [physical({ byRank: [45, 80, 115, 150] }, [{ stat: 'bonusAd', value: 1.1 }]), smolderPassive(0.3)],
  },
  w: {
    id: 'smolder-w', name: 'Achooo!', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    // The sneeze, then one Sneeze Blast on the target.
    damage: [
      physical({ byRank: [65, 85, 105, 125] }, [{ stat: 'bonusAd', value: 0.6 }]),
      physical({ byRank: [10, 35, 60, 85] }, [{ stat: 'bonusAd', value: 0.55 }, { stat: 'ap', value: 0.8 }]),
      smolderPassive(0.55),
    ],
  },
  e: {
    id: 'smolder-e', name: 'Flap, Flap, Flap', maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: 65, castTime: 0, flags: {},
    // All 5 bombs on the target, at once.
    damage: [
      { ...physical({ byRank: [15, 20, 25, 30] }, [{ stat: 'totalAd', value: 0.3 }]), hits: 5 },
      { ...smolderPassive(0.12), hits: 5 },
    ],
  },
  r: {
    id: 'smolder-r', name: 'MMOOOMMMM!', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // The target is in the centre.
    damage: [physical({ byRank: [300, 450, 600] }, [{ stat: 'bonusAd', value: 1.65 }, { stat: 'ap', value: 1.5 }])],
  },
})

const SORAKA = modelled('soraka', {
  // Salvation is movement speed.
  passive: utility('soraka-passive', 'Salvation', 1, null),
  q: {
    id: 'soraka-q', name: 'Starcall', maxRank: 4, cooldown: { byRank: [7, 6, 5, 4] }, cost: { byRank: [45, 50, 55, 60] },
    castTime: 0, flags: {},
    // The empowered (140%) Starcall after healing allies is not modelled.
    damage: [magic({ byRank: [60, 110, 160, 210] }, [{ stat: 'ap', value: 0.4 }])],
  },
  // Astral Infusion heals an ally.
  w: utility('soraka-w', 'Astral Infusion', 4, { byRank: [7, 6, 5, 4] }, { byRank: [55, 60, 65, 70] }),
  e: {
    id: 'soraka-e', name: 'Equinox', maxRank: 4, cooldown: { byRank: [20, 18, 16, 14] }, cost: 70, castTime: 0, flags: {},
    // The cast and the expiry 1.5 seconds later, both at once.
    damage: [{ ...magic({ byRank: [70, 120, 170, 220] }, [{ stat: 'ap', value: 0.4 }]), hits: 2 }],
  },
  // Wish heals allies.
  r: utility('soraka-r', 'Wish', 3, { byRank: [85, 80, 75] }, 100),
})

/** The fifteenth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH15: Champion[] = [FIORA, WUKONG, TWISTED_FATE, SMOLDER, SORAKA]
