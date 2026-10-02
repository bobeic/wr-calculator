import type { Champion } from '@wr-calc/schema'
import { byLevelLine, magic, modelled, physical, utility } from './champion-helpers'

// Batch 5 (2026-10-02): the fifth most-picked champion in each lane on the CN server (all ranks, 2026-09-30):
// Sett (Baron), Graves (Jungle; Cho'Gath is fifth but already modelled), Galio (Mid), Samira (Dragon) and Lux
// (Support). Same approach as the earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage
// dealt, nothing checked in game yet.

const SETT = modelled('sett', {
  passive: {
    id: 'sett-passive', name: 'Pit Grit', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'procEveryN', id: 'sett-passive-right-punch', name: 'Right Punch',
      description: 'Attacks alternate left and right punches. Right punches deal an additional 9 (+50% bonus AD) '
        + 'physical damage and come out 8 times faster than a left punch.',
      support: 'partial',
      supportNotes: "Every second attack gets the bonus. The right punch's faster wind-up, the 2 second reset to a "
        + 'left punch and the missing-Health regeneration are not modelled.',
      n: 2, countsFrom: 'basicAttack', damageType: 'physical', damage: 9,
      ratios: [{ stat: 'ad', layer: 'bonus', value: 0.5 }], resetsOnMiss: false,
    }],
  },
  q: {
    ...utility('sett-q', 'Knuckle Down', 4, { byRank: [9.5, 8, 6.5, 5] }),
    effects: [{
      kind: 'empoweredAttack', id: 'sett-q-knuckle-down', name: 'Knuckle Down',
      description: 'Empowers the next two attacks to deal an additional 5 plus 1% (+0.01% per AD) max Health '
        + 'physical damage.',
      support: 'partial',
      supportNotes: 'The per-AD rate grows by rank (0.01-0.025%) per the table. The movement speed and the monster '
        + 'cap are not modelled. How long the empower lasts unused is not stated (5s assumed).',
      grant: { on: 'abilityCast', slots: ['q'], charges: 2 }, maxCharges: 2, durationSeconds: 5,
      bonus: physical({ byRank: [5, 20, 35, 50] }, [{
        stat: 'targetMaxHp', value: 0.01, perStat: { stat: 'totalAd', value: { byRank: [0.0001, 0.00015, 0.0002, 0.00025] } },
      }]),
    }],
  },
  w: {
    id: 'sett-w', name: 'Haymaker', maxRank: 4, cooldown: { byRank: [16, 14.5, 13, 11.5] }, castTime: 0, flags: {},
    // Only the base true damage: the 25% (+0.275% bonus AD) of Grit consumed depends on damage taken, and the shield
    // isn't modelled. Assumes the target is in the centre (true damage).
    damage: [{ type: 'true', base: { byRank: [80, 105, 130, 155] }, ratios: [], tags: [] }],
  },
  e: {
    id: 'sett-e', name: 'Facebreaker', maxRank: 4, cooldown: { byRank: [13, 11.5, 10, 8.5] }, castTime: 0, flags: {},
    damage: [physical({ byRank: [50, 75, 100, 125] }, [{ stat: 'totalAd', value: 0.6 }])],
  },
  r: {
    id: 'sett-r', name: 'The Show Stopper', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, castTime: 0, flags: {},
    // The 35/45/55% of the grabbed enemy's bonus Health isn't modelled: no damage ratio reads the target's bonus
    // Health.
    damage: [physical({ byRank: [200, 300, 400] }, [{ stat: 'bonusAd', value: 1 }])],
  },
})

const GRAVES = modelled('graves', {
  passive: {
    id: 'graves-passive', name: 'New Destiny', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'onHit', id: 'graves-passive-buckshot', name: '12 Gauge',
      description: 'Attacks fire 4 bullets. Units hit take 72% AD (based on level) physical damage, +24% (based on '
        + 'level) for additional bullets.',
      support: 'partial',
      supportNotes: 'Read as all 4 bullets hitting: 72% + 3 × 24% = 144% AD, i.e. the attack plus 44% AD. The level '
        + "scaling isn't stated, so the level 1 numbers are used at every level. Reloading (2 shells) is not "
        + 'modelled, so sustained DPS is overstated; crits firing 6 bullets at +50% each are not modelled.',
      damageType: 'physical', ratios: [{ stat: 'ad', value: 0.44 }],
    }],
  },
  q: {
    id: 'graves-q', name: 'End of the Line', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] },
    cost: { byRank: [65, 70, 75, 80] }, castTime: 0, flags: {},
    // The detonation lands at once (its 1 second delay isn't modelled).
    damage: [
      physical({ byRank: [70, 90, 110, 130] }, [{ stat: 'bonusAd', value: 0.8 }]),
      physical({ byRank: [80, 130, 180, 230] }, [{ stat: 'bonusAd', value: { byRank: [1.1, 1.3, 1.5, 1.7] } }]),
    ],
  },
  w: {
    id: 'graves-w', name: 'Smoke Screen', maxRank: 4, cooldown: { byRank: [20, 18, 16, 14] },
    cost: { byRank: [75, 80, 85, 90] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 125, 190, 255] }, [{ stat: 'ap', value: 0.6 }])],
  },
  // Quickdraw's Armor and the cooldown refund per bullet aren't damage; not modelled.
  e: utility('graves-e', 'Quickdraw', 4, 13, 40),
  r: {
    id: 'graves-r', name: 'Collateral Damage', maxRank: 3, cooldown: { byRank: [75, 60, 45] }, cost: 100, castTime: 0, flags: {},
    // Only the impact: a target hit by the shell doesn't take the cone.
    damage: [physical({ byRank: [300, 450, 600] }, [{ stat: 'bonusAd', value: 1.5 }])],
  },
})

const GALIO = modelled('galio', {
  passive: {
    id: 'galio-passive', name: 'Colossal Smash', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'galio-passive-colossal-smash', name: 'Colossal Smash',
      description: 'Enhances his next attack to deal 15 + 10 × level (+100% AD +45% AP +60% bonus Magic Resist) '
        + 'magic damage. Hitting an enemy champion with an ability reduces the cooldown by 3 seconds.',
      support: 'partial',
      supportNotes: "The cooldown isn't stated; League of Legends' 5 seconds is used. The 3 second refund per "
        + 'ability and the 40% attack speed on the enhanced attack are not modelled.',
      triggeredBy: ['basicAttack'], damageType: 'magic', damage: byLevelLine(25, 165),
      ratios: [{ stat: 'ad', value: 1 }, { stat: 'ap', value: 0.45 }, { stat: 'mr', layer: 'bonus', value: 0.6 }],
      cooldownSeconds: 5,
    }],
  },
  q: {
    id: 'galio-q', name: 'Winds of War', maxRank: 4, cooldown: { byRank: [11.5, 10, 8.5, 7] }, cost: 75, castTime: 0, flags: {},
    // The tornado's 8% (+2% per 100 AP) max Health lands at once (its 1.5 second duration isn't modelled).
    damage: [
      magic({ byRank: [70, 115, 160, 205] }, [{ stat: 'ap', value: 0.75 }]),
      magic(0, [{ stat: 'targetMaxHp', value: 0.08, perStat: { stat: 'ap', value: 0.0002 } }]),
    ],
  },
  w: {
    id: 'galio-w', name: 'Shield of Durand', maxRank: 4, cooldown: { byRank: [18, 17, 16, 15] }, cost: 50, castTime: 0, flags: {},
    // The damage reduction, the taunt and the passive magic shield are not modelled.
    damage: [magic({ byRank: [40, 80, 120, 160] }, [{ stat: 'ap', value: 0.55 }])],
  },
  e: {
    id: 'galio-e', name: 'Justice Punch', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: 50, castTime: 0, flags: {},
    damage: [magic({ byRank: [90, 140, 190, 240] }, [{ stat: 'ap', value: 0.8 }])],
  },
  r: {
    id: 'galio-r', name: "Hero's Entrance", maxRank: 3, cooldown: { byRank: [90, 80, 70] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.7 }])],
  },
})

const SAMIRA = modelled('samira', {
  // Daredevil Impulse's melee-range bonus depends on positioning, and Style only adds movement speed; not modelled.
  // Inferno Trigger needs S Style; the combo decides when that is.
  passive: utility('samira-passive', 'Daredevil Impulse', 1, null),
  q: {
    id: 'samira-q', name: 'Flair', maxRank: 4, cooldown: { byRank: [6.5, 5, 3.5, 2] }, cost: 30, castTime: 0, flags: {},
    // Crit scaling is not modelled.
    damage: [physical({ byRank: [15, 20, 25, 30] }, [{ stat: 'totalAd', value: 1.25 }])],
  },
  w: {
    id: 'samira-w', name: 'Blade Whirl', maxRank: 4, cooldown: { byRank: [22, 20, 18, 16] }, cost: 60, castTime: 0, flags: {},
    damage: [{ ...physical({ byRank: [20, 40, 60, 80] }, [{ stat: 'bonusAd', value: 0.5 }]), hits: 2 }],
  },
  e: {
    id: 'samira-e', name: 'Wild Rush', maxRank: 4, cooldown: { byRank: [20, 17, 14, 11] }, cost: 40, castTime: 0, flags: {},
    // The cooldown reset on a takedown is not modelled.
    damage: [magic({ byRank: [45, 60, 75, 90] }, [{ stat: 'bonusAd', value: 0.2 }])],
    effects: [{
      kind: 'castBuff', id: 'samira-e-wild-rush', name: 'Wild Rush',
      description: 'Gains bonus Attack Speed for 3 seconds.', support: 'full',
      slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.25, 0.3, 0.35, 0.4] }, durationSeconds: 3, cooldownSeconds: 0,
    }],
  },
  r: {
    id: 'samira-r', name: 'Inferno Trigger', maxRank: 3, cooldown: 6, castTime: 0, flags: {},
    // All 10 shots land at once (the 2.23 second channel isn't modelled), and crits are not modelled.
    damage: [{ ...physical({ byRank: [20, 40, 60] }, [{ stat: 'totalAd', value: 0.5 }]), hits: 10 }],
  },
})

const LUX = modelled('lux', {
  passive: {
    id: 'lux-passive', name: 'Illumination', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'procEveryN', id: 'lux-passive-illumination', name: 'Illumination',
      description: "Damaging abilities mark the target for 5 seconds. Lux's next attack or damaging ability against "
        + 'it detonates the mark for 25.5 (+25% AP) magic damage.',
      support: 'partial',
      supportNotes: 'Every second ability hit detonates (like Hwei\'s passive). Detonating with an attack, the 5 '
        + "second mark and any level scaling (none is stated) are not modelled.",
      condition: { type: 'sourceKind', value: 'ability' },
      n: 2, damageType: 'magic', damage: 25.5, ratios: [{ stat: 'ap', value: 0.25 }], resetsOnMiss: false,
    }],
  },
  q: {
    id: 'lux-q', name: 'Light Binding', maxRank: 4, cooldown: 9, cost: { byRank: [45, 50, 55, 60] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 120, 180, 240] }, [{ stat: 'ap', value: 0.7 }])],
  },
  // Prismatic Barrier only shields; nothing to model one-on-one.
  w: utility('lux-w', 'Prismatic Barrier', 4, { byRank: [12, 11, 10, 9] }, 60),
  e: {
    id: 'lux-e', name: 'Lucent Singularity', maxRank: 4, cooldown: { byRank: [9.5, 9, 8.5, 8] },
    cost: { byRank: [70, 80, 90, 100] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [65, 130, 195, 260] }, [{ stat: 'ap', value: 0.55 }])],
  },
  r: {
    id: 'lux-r', name: 'Final Spark', maxRank: 3, cooldown: { byRank: [55, 45, 40] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [300, 400, 500] }, [{ stat: 'ap', value: 0.75 }])],
  },
})

/** The fifth most-picked champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH5: Champion[] = [SETT, GRAVES, GALIO, SAMIRA, LUX]
