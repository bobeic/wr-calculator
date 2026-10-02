import type { Champion } from '@wr-calc/schema'
import { byLevelLine, magic, modelled, physical, utility } from './champion-helpers'

// Batch 12 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Urgot (Baron), Vi (Jungle), Ekko (Mid), Kalista (Dragon) and Zyra (Support). Same approach as the earlier batches:
// wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const KALISTA_SPEARS = 'kalista-rend-spears'

const URGOT = modelled('urgot', {
  passive: {
    id: 'urgot-passive', name: 'Echoing Flames', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'urgot-passive-echoing-flames', name: 'Echoing Flames',
      description: "Attacks periodically trigger a blast from the leg facing that direction, dealing 60-105% (based on "
        + "level) AD (+3% (based on level) of the target's max Health) physical damage. 15 (based on level) second "
        + 'cooldown per leg.',
      support: 'partial',
      supportNotes: 'One cooldown for all six legs (each leg has its own in game), so it procs far less often here. The '
        + 'AD ratio runs in a straight line from 60% to 105%; the 3% and 15s are used at every level. Purge triggering '
        + 'it is not modelled.',
      triggeredBy: ['basicAttack'], damageType: 'physical', damage: 0,
      ratios: [{ stat: 'ad', value: byLevelLine(0.6, 1.05) }], pctTargetMaxHp: 0.03, cooldownSeconds: 15,
    }],
  },
  q: {
    id: 'urgot-q', name: 'Corrosive Charge', maxRank: 4, cooldown: { byRank: [9.5, 9, 8.5, 8] }, cost: 70, castTime: 0, flags: {},
    damage: [physical({ byRank: [40, 95, 150, 205] }, [{ stat: 'totalAd', value: 0.7 }])],
  },
  w: {
    id: 'urgot-w', name: 'Purge', maxRank: 4, cooldown: { byRank: [12, 8, 4, 0.5] }, cost: { byRank: [30, 20, 10, 0] },
    castTime: 0, flags: {},
    // The first shot; the dot below fires the rest of the 4 seconds.
    damage: [physical(10, [{ stat: 'totalAd', value: { byRank: [0.2, 0.275, 0.35, 0.425] } }])],
    effects: [{
      kind: 'dot', id: 'urgot-w-purge', name: 'Purge',
      description: 'Shoots the nearest enemy rapidly for 4 seconds, dealing 10 (+20% AD) physical damage per shot.',
      support: 'partial',
      supportNotes: "The fire rate isn't stated; League of Legends' 3 shots a second is used (12 over 4 seconds). The "
        + 'on-hit effects at 70% and the infinite duration at max rank are not modelled.',
      damageType: 'physical', tickAmount: 10, tickIntervalSeconds: 1 / 3, durationSeconds: 11 / 3, refresh: 'refresh',
      appliedBy: ['w'], ratios: [{ stat: 'ad', value: { byRank: [0.2, 0.275, 0.35, 0.425] } }],
    }],
  },
  e: {
    id: 'urgot-e', name: 'Disdain', maxRank: 4, cooldown: { byRank: [14, 13, 12, 11] }, cost: { byRank: [60, 70, 80, 90] },
    castTime: 0, flags: {},
    damage: [physical({ byRank: [90, 130, 170, 210] }, [{ stat: 'bonusAd', value: 1 }])],
  },
  r: {
    id: 'urgot-r', name: 'Fear Beyond Death', maxRank: 3, cooldown: { byRank: [60, 55, 50] }, cost: 100, castTime: 0, flags: {},
    // The execute below 25% Health isn't modelled: an execute effect applies to all of Urgot's damage, not just R.
    damage: [physical({ byRank: [100, 225, 350] }, [{ stat: 'bonusAd', value: 0.7 }])],
  },
})

const VI = modelled('vi', {
  passive: {
    id: 'vi-passive', name: 'Denting Blows', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'hitStackProc', id: 'vi-passive-denting-blows', name: 'Denting Blows',
      description: "Every 3rd attack on the same enemy deals bonus physical damage equal to 4.8% (+0.03% per bonus AD) "
        + 'of their max Health, reduces their Armor by 20%, and grants Vi 27% (based on level) Attack Speed.',
      support: 'partial',
      supportNotes: 'Lands as its own hit. The Armor reduction and the attack speed are not modelled. Vault Breaker '
        + 'applying it is not modelled either.',
      stacksToProc: 3, stackWindowSeconds: 4, cooldownSeconds: 0, stacksFrom: ['basicAttack'],
      damage: { type: 'physical', base: 0, ratios: [{ stat: 'targetMaxHp', value: 0.048, perStat: { stat: 'bonusAd', value: 0.0003 } }], tags: [] },
      delivery: { kind: 'instant' },
    }],
  },
  q: {
    id: 'vi-q', name: 'Vault Breaker', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    // Fully charged (the charge-up time isn't modelled).
    damage: [physical({ byRank: [120, 190, 260, 330] }, [{ stat: 'bonusAd', value: 1.2 }])],
  },
  // Blast Shield is a shield.
  w: utility('vi-w', 'Blast Shield', 4, { byRank: [10, 9, 8, 7] }, { byRank: [30, 20, 10, 0] }),
  e: {
    ...utility('vi-e', 'Relentless Force', 4, 1, { byRank: [20, 30, 40, 50] }),
    effects: [{
      kind: 'empoweredAttack', id: 'vi-e-relentless-force', name: 'Relentless Force',
      description: "Empowers Vi's next attack to deal 20 (+15% AD +70% AP) bonus physical damage.",
      support: 'partial',
      supportNotes: 'Its 2 charges (one every 11-8 seconds) are not modelled: the 1 second cooldown lets the combo '
        + 'recast it freely. How long the empower lasts unused is not stated (5s assumed).',
      grant: { on: 'abilityCast', slots: ['e'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: physical({ byRank: [20, 45, 70, 95] }, [{ stat: 'totalAd', value: 0.15 }, { stat: 'ap', value: 0.7 }]),
    }],
  },
  r: {
    id: 'vi-r', name: 'Cease and Desist', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [physical({ byRank: [150, 300, 450] }, [{ stat: 'bonusAd', value: 1.4 }])],
  },
})

const EKKO = modelled('ekko', {
  passive: {
    id: 'ekko-passive', name: 'Z-Drive Resonance', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'hitStackProc', id: 'ekko-passive-z-drive', name: 'Z-Drive Resonance',
      description: 'Every third attack or damaging ability against the same target deals an additional 30 (+80% AP) '
        + 'magic damage. Cannot affect the same target for 5 seconds.',
      support: 'partial',
      supportNotes: "The window for the 3 hits isn't stated (4 seconds assumed). Any level scaling isn't stated "
        + 'either, so 30 is used at every level.',
      stacksToProc: 3, stackWindowSeconds: 4, cooldownSeconds: 5, stacksFrom: ['basicAttack', 'ability'],
      damage: magic(30, [{ stat: 'ap', value: 0.8 }]),
      delivery: { kind: 'instant' },
    }],
  },
  q: {
    id: 'ekko-q', name: 'Timewinder', maxRank: 4, cooldown: { byRank: [8, 7.5, 7, 6.5] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    // Out and back, both at once.
    damage: [
      magic({ byRank: [90, 110, 130, 150] }, [{ stat: 'ap', value: 0.3 }]),
      magic({ byRank: [70, 105, 140, 175] }, [{ stat: 'ap', value: 0.6 }]),
    ],
  },
  w: {
    ...utility('ekko-w', 'Parallel Convergence', 4, { byRank: [20, 18, 16, 14] }, { byRank: [35, 40, 45, 50] }),
    effects: [{
      kind: 'onHit', id: 'ekko-w-passive', name: 'Parallel Convergence (passive)',
      description: 'Attacks against Low Health targets deal an additional 3% (+0.025% AP) missing Health magic damage.',
      support: 'partial',
      supportNotes: '"Low Health" is taken as below 30% (League of Legends\' threshold). The AP part is not modelled.',
      condition: { type: 'targetHpBelow', threshold: 0.3 },
      damageType: 'magic', pctTargetMissingHp: 0.03,
    }],
  },
  e: {
    ...utility('ekko-e', 'Phase Dive', 4, { byRank: [9.5, 8.5, 7.5, 6.5] }, { byRank: [45, 50, 55, 60] }),
    effects: [{
      kind: 'empoweredAttack', id: 'ekko-e-phase-dive', name: 'Phase Dive',
      description: "Ekko's next attack within 3 seconds blinks him to his target and deals an additional 60 (+40% AP) "
        + 'magic damage.',
      support: 'full',
      grant: { on: 'abilityCast', slots: ['e'], charges: 1 }, maxCharges: 1, durationSeconds: 3,
      bonus: magic({ byRank: [60, 90, 120, 150] }, [{ stat: 'ap', value: 0.4 }]),
    }],
  },
  r: {
    id: 'ekko-r', name: 'Chronobreak', maxRank: 3, cooldown: { byRank: [80, 60, 40] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [200, 350, 500] }, [{ stat: 'ap', value: 1.5 }])],
  },
})

const KALISTA = modelled('kalista', {
  // Martial Poise is her hop after attacks.
  passive: utility('kalista-passive', 'Martial Poise', 1, null),
  q: {
    id: 'kalista-q', name: 'Pierce', maxRank: 4, cooldown: { byRank: [8, 7.5, 7, 6.5] }, cost: { byRank: [55, 60, 65, 70] },
    castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 135, 200, 265] }, [{ stat: 'totalAd', value: 1.1 }])],
  },
  // Sentinel's passive needs her Oathsworn ally hitting the same target.
  w: utility('kalista-w', 'Sentinel', 4, 20, 30),
  e: {
    id: 'kalista-e', name: 'Rend', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: 30, castTime: 0, flags: {},
    // The spears in the target are an input, not counted from attacks. Each spear after the first adds rank 4's
    // 42 (+57% AD): per-input bonuses can't scale with rank yet.
    damage: [{
      ...physical({ byRank: [30, 45, 60, 75] }, [{ stat: 'totalAd', value: 0.7, perInput: { inputId: KALISTA_SPEARS, value: 0.57 } }]),
      basePerInput: { inputId: KALISTA_SPEARS, value: 42 },
    }],
    effects: [{
      kind: 'stacking', id: 'kalista-e-rend-spears', name: 'Rend (spears)',
      description: 'On hit, her spears linger in the target for 4 seconds, applying a stacking Rend.',
      support: 'partial', supportNotes: 'Only the input; it grants no stat.',
      inputs: [{ type: 'stackCount', id: KALISTA_SPEARS, label: 'Kalista: Rend spears after the first', min: 0, max: 30, default: 0 }],
      stat: 'ad', perStack: 0, maxStacks: 30, stackInputId: KALISTA_SPEARS,
    }],
  },
  // Fate's Call moves her Oathsworn ally.
  r: utility('kalista-r', "Fate's Call", 3, { byRank: [60, 55, 50] }, 100),
})

const ZYRA = modelled('zyra', {
  // Garden of Thorns' Thorn Spitters are the dot on each ability below.
  passive: utility('zyra-passive', 'Garden of Thorns', 1, null),
  q: {
    id: 'zyra-q', name: 'Deadly Spines', maxRank: 4, cooldown: { byRank: [8, 7.5, 7, 6.5] }, cost: 75, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 115, 170, 225] }, [{ stat: 'ap', value: 0.6 }])],
  },
  // Rampant Growth enrages the plants; not modelled.
  w: utility('zyra-w', 'Rampant Growth', 4, { byRank: [18, 16, 14, 12] }, { byRank: [50, 55, 60, 65] }),
  e: {
    id: 'zyra-e', name: 'Grasping Roots', maxRank: 4, cooldown: 12, cost: { byRank: [60, 70, 80, 90] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 100, 140, 180] }, [{ stat: 'ap', value: 0.4 }])],
  },
  r: {
    id: 'zyra-r', name: 'Stranglethorns', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 225, 300] }, [{ stat: 'ap', value: 0.5 }])],
    effects: [{
      kind: 'dot', id: 'zyra-thorn-spitter', name: 'Thorn Spitter',
      description: 'A Thorn Spitter sprouts when Grasping Roots, Deadly Spines or Stranglethorns hits an enemy champion, '
        + 'attacking it for 6 seconds for 10 (+10% AP) magic damage.',
      support: 'partial',
      supportNotes: "One plant per hit, each attacking once a second (the rate isn't stated). Later plants' 50% damage "
        + 'against the same target is not modelled.',
      damageType: 'magic', tickAmount: 10, tickIntervalSeconds: 1, durationSeconds: 6, refresh: 'stack',
      appliedBy: ['q', 'e', 'r'], ratios: [{ stat: 'ap', value: 0.1 }],
    }],
  },
})

/** The twelfth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH12: Champion[] = [URGOT, VI, EKKO, KALISTA, ZYRA]
