import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 14 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Kayle (Baron), Kindred (Jungle), Aurelion Sol (Mid), Vayne (Dragon) and Braum (Support). Same approach as the
// earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const KINDRED_MARKS = 'kindred-mark-stacks'

const KAYLE = modelled('kayle', {
  passive: {
    id: 'kayle-passive', name: 'Divine Ascent', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'attackStack', id: 'kayle-passive-zeal', name: 'Divine Ascent',
      description: 'Attacks grant 4% (+1% AP) Attack Speed for 5 seconds, stacking up to 5 times.',
      support: 'partial',
      supportNotes: "The +1% AP part, the level 9 flame waves (Starfire Spellblade's passive again at max stacks) and "
        + 'the level 13 permanent stacks are not modelled.',
      stat: 'attackSpeed', amountPerStack: 0.04, maxStacks: 5, durationSeconds: 5,
    }],
  },
  q: {
    id: 'kayle-q', name: 'Radiant Blast', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] }, cost: { byRank: [70, 80, 90, 100] },
    castTime: 0, flags: {},
    // The 20% Armor and Magic Resist reduction isn't modelled: a shred applies on any damage, not just Q.
    damage: [magic({ byRank: [60, 100, 140, 180] }, [{ stat: 'totalAd', value: 0.6 }, { stat: 'ap', value: 0.5 }])],
  },
  // Celestial Blessing heals and hastes.
  w: utility('kayle-w', 'Celestial Blessing', 4, 14, { byRank: [75, 80, 85, 90] }),
  e: {
    ...utility('kayle-e', 'Starfire Spellblade', 4, { byRank: [8, 7.5, 7, 6.5] }),
    effects: [
      {
        kind: 'onHit', id: 'kayle-e-passive', name: 'Starfire Spellblade (passive)',
        description: 'Attacks deal bonus 8 (+5% bonus AD +15% AP) magic damage.', support: 'full',
        damageType: 'magic', flat: { byRank: [8, 11, 14, 17] },
        ratios: [{ stat: 'ad', layer: 'bonus', value: 0.05 }, { stat: 'ap', value: 0.15 }],
      },
      {
        kind: 'empoweredAttack', id: 'kayle-e-active', name: 'Starfire Spellblade',
        description: "Empowers her next attack to deal bonus 7% (+0.02% per AP) magic damage of the target's missing Health.",
        support: 'partial', supportNotes: 'How long the empower lasts unused is not stated (5s assumed).',
        grant: { on: 'abilityCast', slots: ['e'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
        bonus: magic(0, [{ stat: 'targetMissingHp', value: { byRank: [0.07, 0.08, 0.09, 0.1] }, perStat: { stat: 'ap', value: 0.0002 } }]),
      },
    ],
  },
  r: {
    id: 'kayle-r', name: 'Divine Judgment', maxRank: 3, cooldown: { byRank: [100, 90, 80] }, cost: { byRank: [100, 50, 0] },
    castTime: 0, flags: {},
    // Lands at once (the 2.5 seconds of invulnerability first aren't modelled).
    damage: [magic({ byRank: [150, 225, 300] }, [{ stat: 'bonusAd', value: 0.85 }, { stat: 'ap', value: 0.6 }])],
  },
})

const KINDRED = modelled('kindred', {
  passive: {
    id: 'kindred-passive', name: 'Mark of the Kindred', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'stacking', id: 'kindred-passive-marks', name: 'Mark of the Kindred',
      description: 'Takedowns on hunted targets grant Mark stacks that empower her abilities.',
      support: 'partial',
      supportNotes: "Only the input, read by Wolf's Frenzy and Mounting Dread; it grants no stat. The attack range and "
        + "Dance of Arrows' extra attack speed per stack are not modelled.",
      inputs: [{ type: 'stackCount', id: KINDRED_MARKS, label: 'Kindred: Mark stacks', min: 0, max: 30, default: 0 }],
      stat: 'ad', perStack: 0, maxStacks: 30, stackInputId: KINDRED_MARKS,
    }],
  },
  q: {
    id: 'kindred-q', name: 'Dance of Arrows', maxRank: 4, cooldown: { byRank: [3.5, 3, 2.5, 2] }, cost: 35, castTime: 0, flags: {},
    damage: [physical({ byRank: [50, 75, 100, 125] }, [{ stat: 'bonusAd', value: 0.7 }])],
    effects: [{
      kind: 'castBuff', id: 'kindred-q-attack-speed', name: 'Dance of Arrows',
      description: 'Gains 25% Attack Speed for 4 seconds.', support: 'full',
      slots: ['q'], stat: 'attackSpeed', amount: 0.25, durationSeconds: 4, cooldownSeconds: 0,
    }],
  },
  w: {
    id: 'kindred-w', name: "Wolf's Frenzy", maxRank: 4, cooldown: { byRank: [17, 16, 15, 14] }, cost: 40, castTime: 0, flags: {},
    // One maul, at once. The heal is not modelled.
    damage: [magic({ byRank: [25, 30, 35, 40] }, [
      { stat: 'bonusAd', value: 0.2 }, { stat: 'ap', value: 0.2 },
      { stat: 'targetCurrentHp', value: 0.015, perInput: { inputId: KINDRED_MARKS, value: 0.01 } },
    ])],
  },
  e: {
    id: 'kindred-e', name: 'Mounting Dread', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, cost: 50, castTime: 0, flags: {},
    // Wolf's pounce (on Kindred's 3rd attack within 4 seconds) is folded into the cast. Its extra damage below 25%
    // Health is not modelled.
    damage: [physical({ byRank: [90, 115, 140, 165] }, [
      { stat: 'bonusAd', value: 0.8 }, { stat: 'targetMissingHp', value: 0.08, perInput: { inputId: KINDRED_MARKS, value: 0.005 } },
    ])],
  },
  // Lamb's Respite prevents deaths.
  r: utility('kindred-r', "Lamb's Respite", 3, { byRank: [105, 90, 75] }, 100),
})

const AURELION_SOL = modelled('aurelion-sol', {
  // Cosmic Creator's Stardust stacks (Breath of Light's % max Health, Singularity's execute) are not modelled.
  passive: utility('aurelion-sol-passive', 'Cosmic Creator', 1, null),
  q: {
    id: 'aurelion-sol-q', name: 'Breath of Light', maxRank: 4, cooldown: 3, cost: { byRank: [10, 12, 14, 16] }, castTime: 0, flags: {},
    // The first second (breath plus burst); the dot below deals the other 2 of its 3.25 seconds.
    damage: [
      magic({ byRank: [58, 73, 88, 103] }, [{ stat: 'ap', value: 0.6 }]),
      magic({ byRank: [70, 80, 90, 100] }, [{ stat: 'ap', value: 0.35 }]),
    ],
    effects: [{
      kind: 'dot', id: 'aurelion-sol-q-breath', name: 'Breath of Light',
      description: 'Breathes starfire for 3.25 seconds dealing 58 + 2.5 x level (+60% AP) magic damage per second, plus '
        + 'a burst of 70 + 0.5 x level (+35% AP) magic damage for every second on the same target.',
      support: 'partial',
      supportNotes: "The table's per-rank numbers are used; the text's per-level parts are left out. The target stays "
        + 'in the breath for 3 seconds. Astral Flight\'s +15% and the infinite duration at max rank are not modelled.',
      damageType: 'magic', tickAmount: { byRank: [128, 153, 178, 203] }, tickIntervalSeconds: 1, durationSeconds: 2,
      refresh: 'refresh', appliedBy: ['q'], ratios: [{ stat: 'ap', value: 0.95 }],
    }],
  },
  // Astral Flight is movement (and Breath of Light's bonus while flying, not modelled).
  w: utility('aurelion-sol-w', 'Astral Flight', 4, { byRank: [18, 17, 16, 15] }, 80),
  e: {
    id: 'aurelion-sol-e', name: 'Singularity', maxRank: 4, cooldown: 12, cost: { byRank: [80, 85, 90, 95] }, castTime: 0, flags: {},
    // The first second; the dot below deals the other 4. The execute below 5% Health isn't modelled.
    damage: [magic({ byRank: [20, 27.5, 35, 42.5] }, [{ stat: 'ap', value: 0.15 }])],
    effects: [{
      kind: 'dot', id: 'aurelion-sol-e-singularity', name: 'Singularity',
      description: 'Summons a black hole, dealing 20 (+15% AP) magic damage per second for 5 seconds.',
      support: 'partial', supportNotes: 'The target stays in the black hole for all 5 seconds.',
      damageType: 'magic', tickAmount: { byRank: [20, 27.5, 35, 42.5] }, tickIntervalSeconds: 1, durationSeconds: 4,
      refresh: 'refresh', appliedBy: ['e'], ratios: [{ stat: 'ap', value: 0.15 }],
    }],
  },
  r: {
    id: 'aurelion-sol-r', name: 'Falling Star', maxRank: 3, cooldown: { byRank: [85, 80, 75] }, cost: 100, castTime: 0, flags: {},
    // Falling Star only; The Skies Descend needs 65 Stardust.
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.65 }])],
  },
})

const VAYNE = modelled('vayne', {
  // Night Hunter is movement speed.
  passive: utility('vayne-passive', 'Night Hunter', 1, null),
  q: {
    ...utility('vayne-q', 'Tumble', 4, { byRank: [5, 4, 3, 2] }, 30),
    effects: [{
      kind: 'empoweredAttack', id: 'vayne-q-tumble', name: 'Tumble',
      description: 'Dashes forward and empowers her next attack to deal an additional 50% AD physical damage.',
      support: 'partial', supportNotes: 'How long the empower lasts unused is not stated (5s assumed).',
      grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: physical(0, [{ stat: 'totalAd', value: { byRank: [0.5, 0.6, 0.7, 0.8] } }]),
    }],
  },
  w: {
    ...utility('vayne-w', 'Silver Bolts', 4, { byRank: [18, 17, 16, 15] }, 45),
    effects: [
      {
        kind: 'hitStackProc', id: 'vayne-w-silver-bolts', name: 'Silver Bolts',
        description: "Every third consecutive attack or ability on the same target deals bonus true damage equal to 6% "
          + "of the enemy's maximum Health (at least 50).",
        support: 'partial',
        supportNotes: '"Consecutive" taken as within 3.5 seconds of each other (not stated). The minimum (50-95) is '
          + 'not applied.',
        stacksToProc: 3, stackWindowSeconds: 3.5, cooldownSeconds: 0, stacksFrom: ['basicAttack', 'ability'],
        damage: { type: 'true', base: 0, ratios: [{ stat: 'targetMaxHp', value: { byRank: [0.06, 0.07, 0.08, 0.09] } }], tags: [] },
        delivery: { kind: 'instant' },
      },
      {
        kind: 'castBuff', id: 'vayne-w-active', name: 'Silver Bolts (active)',
        description: 'Gains 10% Attack Speed and 10% Omnivamp for 3 seconds.',
        support: 'partial', supportNotes: 'The Omnivamp is not modelled.',
        slots: ['w'], stat: 'attackSpeed', amount: { byRank: [0.1, 0.15, 0.2, 0.25] }, durationSeconds: 3, cooldownSeconds: 0,
      },
    ],
  },
  e: {
    id: 'vayne-e', name: 'Condemn', maxRank: 4, cooldown: { byRank: [21, 18, 15, 12] }, cost: 90, castTime: 0, flags: {},
    // The extra 105 (+75% bonus AD) and stun from hitting a wall are not modelled.
    damage: [physical({ byRank: [50, 80, 110, 140] }, [{ stat: 'bonusAd', value: 0.55 }])],
  },
  r: {
    ...utility('vayne-r', 'Final Hour', 3, { byRank: [70, 65, 60] }, 100),
    effects: [{
      kind: 'castBuff', id: 'vayne-r-final-hour', name: 'Final Hour',
      description: 'Gains 30 Attack Damage for 8 seconds.',
      support: 'partial', supportNotes: 'Lasts 8 seconds at every rank (10/12 at ranks 2/3 isn\'t modelled); extensions '
        + 'from takedowns and the strengthened Tumble are not modelled.',
      slots: ['r'], stat: 'ad', amount: { byRank: [30, 40, 50] }, durationSeconds: 8, cooldownSeconds: 0,
    }],
  },
})

const BRAUM = modelled('braum', {
  passive: {
    id: 'braum-passive', name: 'Concussive Blows', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'hitStackProc', id: 'braum-passive-concussive-blows', name: 'Concussive Blows',
      description: "Braum's attacks apply Concussive Blows for 4 seconds. Upon reaching 4 stacks, the enemy is stunned "
        + 'and takes 45 (based on level) magic damage. Enemies cannot receive stacks for 8 seconds after being stunned.',
      support: 'partial',
      supportNotes: "Winter's Bite's stack counts (any ability hit does here). 45 at every level (the scaling isn't "
        + 'stated); the extra 9 per attack during the 8 second immunity and allies\' stacks are not modelled.',
      stacksToProc: 4, stackWindowSeconds: 4, cooldownSeconds: 8, stacksFrom: ['basicAttack', 'ability'],
      damage: magic(45, []),
      delivery: { kind: 'instant' },
    }],
  },
  q: {
    id: 'braum-q', name: "Winter's Bite", maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: { byRank: [40, 45, 50, 55] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 120, 180, 240] }, [{ stat: 'maxHp', value: 0.03 }])],
  },
  // Stand Behind Me and Unbreakable are defensive.
  w: utility('braum-w', 'Stand Behind Me', 4, { byRank: [11, 10, 9, 8] }, { byRank: [55, 60, 65, 70] }),
  e: utility('braum-e', 'Unbreakable', 4, { byRank: [16, 14, 12, 10] }, { byRank: [35, 40, 45, 50] }),
  r: {
    id: 'braum-r', name: 'Glacial Fissure', maxRank: 3, cooldown: { byRank: [75, 70, 65] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.6 }])],
  },
})

/** The fourteenth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH14: Champion[] = [KAYLE, KINDRED, AURELION_SOL, VAYNE, BRAUM]
