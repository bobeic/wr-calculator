import type { Champion } from '@wr-calc/schema'
import { byLevelLine, magic, modelled, physical, utility } from './champion-helpers'

// Batch 6 (2026-10-02): the next most-picked champion in each lane on the CN server not modelled yet (all ranks,
// 2026-09-30): Dr. Mundo (Baron), Tryndamere (Jungle), Mel (Mid), Jinx (Dragon) and Seraphine (Support). Same approach
// as the earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in
// game yet.

const TRYNDAMERE_FURY = 'tryndamere-fury'

const DR_MUNDO = modelled('dr-mundo', {
  // Goes Where He Pleases is crowd-control immunity and regeneration; nothing to model one-on-one.
  passive: utility('dr-mundo-passive', 'Goes Where He Pleases', 1, null),
  q: {
    id: 'dr-mundo-q', name: 'Infected Bonesaw', maxRank: 4, cooldown: 4, cost: 50, castTime: 0, flags: {},
    // The minimum damage (90/160/230/300) isn't modelled: ability damage has no floor. It only matters against
    // targets below ~450-1000 Health.
    damage: [magic(0, [{ stat: 'targetCurrentHp', value: { byRank: [0.2, 0.23, 0.26, 0.29] } }])],
  },
  w: {
    id: 'dr-mundo-w', name: 'Heart Zapper', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, castTime: 0, flags: {},
    // The 4 seconds of charge ticks land at once with the detonation. The text gives 20 per second at rank 1; the
    // table's 20/40/60/80 is read as both the per-second and the detonation base. The heal is not modelled.
    damage: [
      { ...magic({ byRank: [20, 40, 60, 80] }, []), hits: 4 },
      magic({ byRank: [20, 40, 60, 80] }, [{ stat: 'bonusHp', value: 0.05 }]),
    ],
  },
  e: {
    ...utility('dr-mundo-e', 'Blunt Force Trauma', 4, { byRank: [8, 7.5, 7, 6.5] }, { byRank: [10, 20, 30, 40] }),
    effects: [{
      kind: 'empoweredAttack', id: 'dr-mundo-e-blunt-force-trauma', name: 'Blunt Force Trauma',
      description: 'Empowers the next attack to deal an additional 5 (+5% bonus Health) physical damage, increased by up '
        + "to 60% based on Dr. Mundo's missing Health.",
      support: 'partial',
      supportNotes: "Taken at full Health: the up-to-60% increase and the passive's AD from missing Health need Dr. "
        + 'Mundo\'s own missing Health, which the engine doesn\'t track. How long the empower lasts unused is not '
        + 'stated (5s assumed).',
      grant: { on: 'abilityCast', slots: ['e'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: physical({ byRank: [5, 20, 35, 50] }, [{ stat: 'bonusHp', value: 0.05 }]),
    }],
  },
  // Maximum Dosage's AD (4% bonus Health) isn't modelled: a cast buff can't scale with a stat yet. Heals aren't either.
  r: utility('dr-mundo-r', 'Maximum Dosage', 3, { byRank: [70, 65, 60] }),
})

const TRYNDAMERE = modelled('tryndamere', {
  passive: {
    id: 'tryndamere-passive', name: 'Battle Fury', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'stacking', id: 'tryndamere-passive-fury', name: 'Battle Fury',
      description: 'Gains 0.32% (based on level) Critical Rate per point of Fury (5 per attack, 10 per crit).',
      support: 'partial',
      supportNotes: "Fury is an input, not built by attacking. The level scaling isn't stated, so 0.32% is used at "
        + 'every level. Crit above 100% turning into AD is not modelled.',
      inputs: [{ type: 'stackCount', id: TRYNDAMERE_FURY, label: 'Tryndamere: Fury', min: 0, max: 100, default: 0 }],
      stat: 'critChance', perStack: 0.0032, maxStacks: 100, stackInputId: TRYNDAMERE_FURY,
    }],
  },
  // Bloodlust's AD scales with Tryndamere's own missing Health (not tracked); the active is a heal.
  q: utility('tryndamere-q', 'Bloodlust', 4, 12),
  // Mocking Shout lowers the enemy's AD; nothing Tryndamere deals.
  w: utility('tryndamere-w', 'Mocking Shout', 4, 12),
  e: {
    id: 'tryndamere-e', name: 'Spinning Slash', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] }, castTime: 0, flags: {},
    // The cooldown refund on crits is not modelled.
    damage: [physical({ byRank: [80, 120, 160, 200] }, [{ stat: 'bonusAd', value: 1 }, { stat: 'ap', value: 0.8 }])],
  },
  // Undying Rage keeps him alive and grants Fury; nothing to model one-on-one.
  r: utility('tryndamere-r', 'Undying Rage', 3, { byRank: [90, 80, 70] }),
})

const MEL = modelled('mel', {
  passive: {
    id: 'mel-passive', name: 'Searing Brilliance', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'spellblade', id: 'mel-passive-projectile-burst', name: 'Projectile Burst',
      description: 'Her next attack after using an ability fires 3 extra projectiles, each dealing 3-33 (based on '
        + 'level) (+3% AP) magic damage.',
      support: 'partial',
      supportNotes: 'The 3 projectiles are one hit of 3x the damage. Stacking up to 9 projectiles from several '
        + 'abilities, and Overwhelm (stored damage that executes the target), are not modelled. Values between '
        + 'levels 1 and 15 assume a straight line.',
      damageType: 'magic', bonusDamage: byLevelLine(9, 99), ratios: [{ stat: 'ap', value: 0.09 }], internalCooldownSeconds: 0,
    }],
  },
  q: {
    id: 'mel-q', name: 'Radiant Volley', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] },
    cost: { byRank: [70, 80, 90, 100] }, castTime: 0, flags: {},
    // Every explosion hits: 7/8/9/10 explosions of 11/14/17/20 (+6% AP).
    damage: [magic({ byRank: [77, 112, 153, 200] }, [{ stat: 'ap', value: { byRank: [0.42, 0.48, 0.54, 0.6] } }])],
  },
  // Rebuttal reflects projectiles; nothing Mel deals on her own.
  w: utility('mel-w', 'Rebuttal', 4, { byRank: [38, 36, 34, 32] }, { byRank: [60, 40, 20, 0] }),
  e: {
    id: 'mel-e', name: 'Solar Snare', maxRank: 4, cooldown: { byRank: [11.5, 11, 10.5, 10] },
    cost: { byRank: [50, 55, 60, 65] }, castTime: 0, flags: {},
    // The area's 20/40/60/80 (+6% AP) per second isn't modelled: how long the target stays in it isn't stated.
    damage: [magic({ byRank: [55, 110, 165, 220] }, [{ stat: 'ap', value: 0.5 }])],
  },
  r: {
    id: 'mel-r', name: 'Golden Eclipse', maxRank: 3, cooldown: { byRank: [95, 80, 65] }, cost: 100, castTime: 0, flags: {},
    // Only the base damage; the 4/7/10 (+2.5% AP) per Overwhelm stack and the passive's bigger Overwhelm aren't
    // modelled (Overwhelm isn't).
    damage: [magic({ byRank: [100, 150, 200] }, [{ stat: 'ap', value: 0.25 }])],
  },
})

const JINX = modelled('jinx', {
  // Get Excited! needs a takedown to trigger.
  passive: utility('jinx-passive', 'Get Excited!', 1, null),
  q: {
    ...utility('jinx-q', 'Switcheroo!', 4, 1, 20),
    effects: [{
      kind: 'attackStack', id: 'jinx-q-pow-pow', name: 'Pow-Pow',
      description: 'Pow-Pow attacks grant bonus Attack Speed for 2.5 seconds, stacking 3 times for a total of '
        + '35/60/85/110%.',
      support: 'partial',
      supportNotes: 'Jinx is taken to stay on Pow-Pow (the minigun). Fishbones (rockets: mana per attack, +range, 112% '
        + 'damage in an area) is not modelled.',
      stat: 'attackSpeed', amountPerStack: { byRank: [0.35 / 3, 0.6 / 3, 0.85 / 3, 1.1 / 3] }, maxStacks: 3,
      durationSeconds: 2.5,
    }],
  },
  w: {
    id: 'jinx-w', name: 'Zap!', maxRank: 4, cooldown: { byRank: [8, 7, 6, 5] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    damage: [physical({ byRank: [10, 80, 150, 220] }, [{ stat: 'totalAd', value: 1.6 }])],
  },
  e: {
    id: 'jinx-e', name: 'Flame Chompers!', maxRank: 4, cooldown: { byRank: [15, 13, 11, 9] }, cost: 70, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 140, 210, 280] }, [{ stat: 'ap', value: 1 }])],
  },
  r: {
    id: 'jinx-r', name: 'Super Mega Death Rocket!', maxRank: 3, cooldown: { byRank: [60, 50, 40] }, cost: 100, castTime: 0, flags: {},
    // At full damage (after a second of travel); the low end (25/35/45 +12% bonus AD) is for point-blank hits.
    damage: [physical({ byRank: [250, 350, 450] }, [
      { stat: 'bonusAd', value: 1.2 }, { stat: 'targetMissingHp', value: { byRank: [0.25, 0.3, 0.35] } },
    ])],
  },
})

const SERAPHINE = modelled('seraphine', {
  passive: {
    id: 'seraphine-passive', name: 'Stage Presence', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'empoweredAttack', id: 'seraphine-passive-harmony', name: 'Harmony',
      description: 'Casting an ability grants a Note. For each Note, her next attack deals an additional 4 (+4% AP) '
        + 'magic damage.',
      support: 'partial',
      supportNotes: 'One Note per cast, spent by the next attack (Notes from nearby allies and several Notes on one '
        + 'attack are not modelled). How long a Note lasts unused is 5s per the text. Echo (every third basic '
        + 'ability cast again) is not modelled.',
      grant: { on: 'abilityCast', charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: magic(4, [{ stat: 'ap', value: 0.04 }]),
    }],
  },
  q: {
    id: 'seraphine-q', name: 'High Note', maxRank: 4, cooldown: { byRank: [11, 9, 7, 5] }, cost: { byRank: [60, 65, 70, 75] },
    castTime: 0, flags: {},
    // The 0-50% increase from the target's missing Health isn't modelled.
    damage: [magic({ byRank: [60, 75, 90, 105] }, [{ stat: 'ap', value: 0.45 }])],
  },
  // Surround Sound shields and heals allies.
  w: utility('seraphine-w', 'Surround Sound', 4, { byRank: [23, 22, 21, 20] }, { byRank: [40, 60, 80, 100] }),
  e: {
    id: 'seraphine-e', name: 'Beat Drop', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: { byRank: [60, 70, 80, 90] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 95, 130, 165] }, [{ stat: 'ap', value: 0.4 }])],
  },
  r: {
    id: 'seraphine-r', name: 'Encore', maxRank: 3, cooldown: { byRank: [105, 90, 75] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.7 }])],
  },
})

/** The sixth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH6: Champion[] = [DR_MUNDO, TRYNDAMERE, MEL, JINX, SERAPHINE]
