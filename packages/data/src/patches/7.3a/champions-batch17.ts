import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 17 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Jax (Baron), Nidalee (Jungle), Aurora (Mid), Lucian (Dragon) and Maokai (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const JAX = modelled('jax', {
  passive: {
    id: 'jax-passive', name: 'Relentless Assault', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'attackStack', id: 'jax-passive-relentless-assault', name: 'Relentless Assault',
      description: 'Attacks grant 6% (based on level) Attack Speed for 3 seconds (max 5 stacks).',
      support: 'partial', supportNotes: "6% at every level (the scaling isn't stated).",
      stat: 'attackSpeed', amountPerStack: 0.06, maxStacks: 5, durationSeconds: 3,
    }],
  },
  q: {
    id: 'jax-q', name: 'Leap Strike', maxRank: 4, cooldown: { byRank: [7.5, 7, 6.5, 6] }, cost: 65, castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 125, 180, 235] }, [{ stat: 'bonusAd', value: 1 }])],
  },
  w: {
    ...utility('jax-w', 'Empower', 4, { byRank: [6, 5, 4, 3] }, 30),
    effects: [{
      kind: 'empoweredAttack', id: 'jax-w-empower', name: 'Empower',
      description: 'Empowers the next attack or Leap Strike to deal an additional 55 (+60% AP) magic damage.',
      support: 'partial',
      supportNotes: 'Only an attack spends it (Leap Strike doesn\'t). How long the empower lasts unused is not stated '
        + '(5s assumed).',
      grant: { on: 'abilityCast', slots: ['w'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: magic({ byRank: [55, 100, 145, 190] }, [{ stat: 'ap', value: 0.6 }]),
    }],
  },
  e: {
    id: 'jax-e', name: 'Counter Strike', maxRank: 4, cooldown: { byRank: [12.5, 11, 9.5, 8] }, cost: { byRank: [60, 70, 80, 90] },
    castTime: 0, flags: {},
    // At once (the 2 second stance isn't modelled), with no dodged attacks (no +20% each).
    damage: [magic({ byRank: [35, 75, 115, 155] }, [{ stat: 'ap', value: 0.7 }, { stat: 'targetMaxHp', value: 0.035 }])],
  },
  r: {
    id: 'jax-r', name: "Grandmaster's Might", maxRank: 3, cooldown: 55, cost: 100, castTime: 0, flags: {},
    // The resists gained, and every 2nd attack procing the passive while active, are not modelled.
    damage: [magic({ byRank: [100, 200, 300] }, [{ stat: 'ap', value: 1 }])],
    effects: [{
      kind: 'procEveryN', id: 'jax-r-passive', name: "Grandmaster's Might (passive)",
      description: 'Deals an additional 75 (+70% AP) magic damage with every 3 consecutive attacks within 3 seconds.',
      support: 'partial', supportNotes: 'Every 3rd attack; the 3 second window is not modelled.',
      n: 3, countsFrom: 'basicAttack', damageType: 'magic', damage: { byRank: [75, 130, 185] },
      ratios: [{ stat: 'ap', value: 0.7 }], resetsOnMiss: false,
    }],
  },
})

const NIDALEE = modelled('nidalee', {
  // Prowl is movement speed and the Hunted mark.
  passive: utility('nidalee-passive', 'Prowl', 1, null),
  q: {
    id: 'nidalee-q', name: 'Javelin Toss', maxRank: 4, cooldown: 5, cost: { byRank: [50, 55, 60, 65] }, castTime: 0, flags: {},
    // At max range (the full 225 +125% AP); shorter throws deal less.
    damage: [magic({ byRank: [225, 300, 375, 450] }, [{ stat: 'ap', value: 1.25 }])],
  },
  w: {
    id: 'nidalee-w', name: 'Bushwhack', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: { byRank: [30, 35, 40, 45] },
    castTime: 0, flags: {},
    // The first second (the target is assumed to walk onto the trap at once); the dot below deals the other 3.
    damage: [magic({ byRank: [10, 20, 30, 40] }, [{ stat: 'ap', value: 0.04 }])],
    effects: [{
      kind: 'dot', id: 'nidalee-w-bushwhack', name: 'Bushwhack',
      description: 'When an enemy walks over the trap, it deals 10 (+4% AP) magic damage per second for 4 seconds.',
      support: 'full',
      damageType: 'magic', tickAmount: { byRank: [10, 20, 30, 40] }, tickIntervalSeconds: 1, durationSeconds: 3,
      refresh: 'refresh', appliedBy: ['w'], ratios: [{ stat: 'ap', value: 0.04 }],
    }],
  },
  e: {
    ...utility('nidalee-e', 'Primal Surge', 4, 12, { byRank: [50, 55, 60, 65] }),
    effects: [{
      kind: 'castBuff', id: 'nidalee-e-attack-speed', name: 'Primal Surge',
      description: 'Grants the target 30% Attack Speed for 7 seconds.',
      support: 'partial', supportNotes: 'Cast on herself. The heal is not modelled.',
      slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.3, 0.4, 0.5, 0.6] }, durationSeconds: 7, cooldownSeconds: 0,
    }],
  },
  // Aspect of the Cougar swaps forms; Cougar Form is not modelled (Human Form only).
  r: utility('nidalee-r', 'Aspect of the Cougar', 4, 3),
})

const AURORA = modelled('aurora', {
  passive: {
    id: 'aurora-passive', name: 'Spirit Abjuration', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'hitStackProc', id: 'aurora-passive-exorcise', name: 'Spirit Abjuration',
      description: "Damaging an enemy 3 times with abilities or attacks exorcises them, dealing (2.5% +2% per 100 AP) of "
        + "the target's max Health as magic damage.",
      support: 'partial',
      supportNotes: "The window for the 3 hits isn't stated (4 seconds assumed). The spirits' healing is not modelled.",
      stacksToProc: 3, stackWindowSeconds: 4, cooldownSeconds: 0, stacksFrom: ['basicAttack', 'ability'],
      damage: magic(0, [{ stat: 'targetMaxHp', value: 0.025, perStat: { stat: 'ap', value: 0.0002 } }]),
      delivery: { kind: 'instant' },
    }],
  },
  q: {
    id: 'aurora-q', name: 'Twofold Hex', maxRank: 4, cooldown: { byRank: [8, 7.5, 7, 6.5] }, cost: 60, castTime: 0, flags: {},
    // The cast and the recast, both at once. The recast's up-to-50% from missing Health applies to its base only,
    // as a straight line.
    damage: [
      magic({ byRank: [40, 70, 100, 130] }, [{ stat: 'ap', value: 0.33 }]),
      magic({ byRank: [40, 70, 100, 130] }, [
        { stat: 'ap', value: 0.33 }, { stat: 'targetMissingHpFraction', value: { byRank: [20, 35, 50, 65] } },
      ]),
    ],
  },
  // Across the Veil is a hop and invisibility.
  w: utility('aurora-w', 'Across the Veil', 4, { byRank: [21, 20, 19, 18] }, 80),
  e: {
    id: 'aurora-e', name: 'The Weirding', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, cost: 80, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 130, 180, 230] }, [{ stat: 'ap', value: 0.65 }])],
  },
  r: {
    id: 'aurora-r', name: 'Between Worlds', maxRank: 3, cooldown: { byRank: [100, 90, 80] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.5 }])],
  },
})

const LUCIAN = modelled('lucian', {
  passive: {
    id: 'lucian-passive', name: 'Lightslinger', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'spellblade', id: 'lucian-passive-lightslinger', name: 'Lightslinger',
      description: "After using an ability, Lucian's next attack within 3.5 seconds fires two shots. The second shot "
        + 'deals 40% (based on level) physical damage.',
      support: 'partial',
      supportNotes: "The second shot is folded into the first as +40% AD (40% at every level; the scaling isn't "
        + 'stated); it applying on-hit effects and critting on its own are not modelled. Vigilance (from allies) is not '
        + 'modelled.',
      damageType: 'physical', bonusDamage: 0, ratios: [{ stat: 'ad', value: 0.4 }], internalCooldownSeconds: 0,
    }],
  },
  q: {
    id: 'lucian-q', name: 'Piercing Light', maxRank: 4, cooldown: { byRank: [9.5, 8, 6.5, 5] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    damage: [physical({ byRank: [75, 125, 175, 225] }, [{ stat: 'bonusAd', value: 1 }])],
  },
  w: {
    id: 'lucian-w', name: 'Ardent Blaze', maxRank: 4, cooldown: { byRank: [13, 11.5, 10, 8.5] }, cost: 70, castTime: 0, flags: {},
    damage: [magic({ byRank: [75, 125, 175, 225] }, [{ stat: 'ap', value: 0.9 }])],
  },
  // Relentless Pursuit is a dash.
  e: utility('lucian-e', 'Relentless Pursuit', 4, { byRank: [20.5, 18, 15.5, 13] }, { byRank: [45, 30, 15, 0] }),
  r: {
    id: 'lucian-r', name: 'The Culling', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    // All 20 shots on the target, at once (the 3 seconds aren't modelled). Extra shots from crit are not modelled.
    damage: [{ ...physical({ byRank: [20, 25, 30] }, [{ stat: 'totalAd', value: 0.25 }, { stat: 'ap', value: 0.15 }]), hits: 20 }],
  },
})

const MAOKAI = modelled('maokai', {
  // Sap Magic heals.
  passive: utility('maokai-passive', 'Sap Magic', 1, null),
  q: {
    id: 'maokai-q', name: 'Bramble Smash', maxRank: 4, cooldown: { byRank: [8, 7, 6, 5] }, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 115, 170, 225] }, [
      { stat: 'ap', value: 0.5 }, { stat: 'targetMaxHp', value: { byRank: [0.025, 0.03, 0.035, 0.04] } },
    ])],
  },
  w: {
    id: 'maokai-w', name: 'Twisted Advance', maxRank: 4, cooldown: { byRank: [14, 13, 12, 11] }, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 95, 130, 165] }, [{ stat: 'ap', value: 0.5 }])],
  },
  e: {
    id: 'maokai-e', name: 'Sapling Toss', maxRank: 4, cooldown: 14, cost: { byRank: [45, 55, 65, 75] }, castTime: 0, flags: {},
    // One sapling outside brush, at once (it has to reach the target).
    damage: [magic({ byRank: [60, 90, 120, 150] }, [{ stat: 'ap', value: 0.25 }, { stat: 'bonusHp', value: 0.06 }])],
  },
  r: {
    id: 'maokai-r', name: "Nature's Grasp", maxRank: 3, cooldown: { byRank: [80, 75, 70] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [175, 250, 325] }, [{ stat: 'ap', value: 0.65 }])],
  },
})

/** The seventeenth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH17: Champion[] = [JAX, NIDALEE, AURORA, LUCIAN, MAOKAI]
