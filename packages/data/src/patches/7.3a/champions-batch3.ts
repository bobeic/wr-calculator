import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 3 (2026-10-02): the third most-picked champion in each lane on the CN server (all ranks, 2026-09-30):
// Garen (Baron), Xin Zhao (Jungle), Brand (Mid), Yunara (Dragon) and Thresh (Support). Same approach as
// champions.ts and champions-batch2.ts: wrpocket's 7.3a text (via wrpocket.app/site_data/champions/<slug>.json,
// which carries the full tooltips the champion page itself only renders client-side), one-on-one damage dealt,
// nothing checked in game yet.

const THRESH_SOULS = 'thresh-souls'

const GAREN = modelled('garen', {
  // Perseverance is an out-of-combat Health regen; nothing to model one-on-one.
  passive: utility('garen-passive', 'Perseverance', 1, null),
  q: {
    id: 'garen-q', name: 'Decisive Strike', maxRank: 4, cooldown: { byRank: [9, 8.5, 8, 7.5] },
    castTime: 0, flags: {},
    // The slow cleanse/immunity and the silence on the empowered attack are not modelled.
    damage: [physical({ byRank: [40, 80, 120, 160] }, [{ stat: 'totalAd', value: 0.4 }])],
  },
  // Courage is a shield, damage reduction and tenacity buff; nothing to model one-on-one.
  w: utility('garen-w', 'Courage', 4, { byRank: [18, 16, 14, 12] }),
  e: {
    id: 'garen-e', name: 'Judgment', maxRank: 4, cooldown: 9, castTime: 0, flags: {},
    damage: [],
    effects: [{
      kind: 'dot', id: 'garen-e-judgment', name: 'Judgment',
      description: 'Spins for 3 seconds, dealing 13 (+25% AD) physical damage up to 8 times.',
      support: 'partial',
      supportNotes: 'The extra spins past level 4 (up to 11), the 20% increased damage to the nearest target, and '
        + "the 6-hit armor shred (the engine has no way to gate a resist reduction on a landed-hit count) aren't "
        + 'modelled.',
      damageType: 'physical', tickAmount: { byRank: [13, 17, 21, 25] }, tickIntervalSeconds: 3 / 8,
      durationSeconds: 3, refresh: 'ignore',
      ratios: [{ stat: 'ad', value: { byRank: [0.25, 0.3, 0.35, 0.4] } }],
    }],
  },
  r: {
    id: 'garen-r', name: 'Demacian Justice', maxRank: 3, cooldown: { byRank: [70, 65, 60] },
    castTime: 0, flags: {},
    // Only the primary target's execute is modelled; the half-damage hit to nearby enemies is not (one-on-one).
    damage: [{
      type: 'true', base: { byRank: [150, 250, 350] },
      ratios: [{ stat: 'targetMissingHp', value: 0.15, perStat: { stat: 'bonusAd', value: 0.0012 } }],
      tags: [],
    }],
  },
})

const XIN_ZHAO = modelled('xin-zhao', {
  passive: {
    id: 'xin-zhao-passive', name: 'Determination', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'procEveryN', id: 'xin-zhao-passive-determination', name: 'Determination',
      description: 'Every third attack deals an additional 22% AD physical damage and heals for 7 (+10% AD +40% AP).',
      support: 'partial', supportNotes: 'The heal is not modelled.',
      n: 3, countsFrom: 'basicAttack', damageType: 'physical', damage: 0,
      ratios: [{ stat: 'ad', value: 0.22 }], resetsOnMiss: false,
    }],
  },
  q: {
    ...utility('xin-zhao-q', 'Three Talon Strike', 4, { byRank: [9, 8, 7, 6] }, 30),
    effects: [{
      kind: 'empoweredAttack', id: 'xin-zhao-q-three-talon-strike', name: 'Three Talon Strike',
      description: 'Empowers the next 3 attacks to deal an additional 20 (+40% bonus AD) physical damage.',
      support: 'partial',
      supportNotes: 'The knock-up on the third hit and the cooldown reduction on other abilities are not modelled. '
        + 'How long the 3 charges last is not stated (10 s assumed).',
      grant: { on: 'abilityCast', slots: ['q'], charges: 3 }, maxCharges: 3, durationSeconds: 10,
      bonus: physical({ byRank: [20, 28, 36, 44] }, [{ stat: 'bonusAd', value: 0.4 }]),
    }],
  },
  w: {
    id: 'xin-zhao-w', name: 'Wind Becomes Lightning', maxRank: 4, cooldown: { byRank: [11, 9.5, 8, 6.5] },
    cost: 45, castTime: 0, flags: {},
    // Both slows and the Challenge mark are not modelled.
    damage: [
      physical({ byRank: [40, 50, 60, 70] }, [{ stat: 'totalAd', value: 0.5 }]),
      physical({ byRank: [40, 85, 130, 175] }, [{ stat: 'totalAd', value: 0.75 }]),
    ],
  },
  e: {
    id: 'xin-zhao-e', name: 'Audacious Charge', maxRank: 4, cooldown: 11, cost: 50, castTime: 0, flags: {},
    damage: [magic({ byRank: [55, 90, 125, 160] }, [{ stat: 'ap', value: 0.8 }])],
    effects: [{
      kind: 'castBuff', id: 'xin-zhao-e-attack-speed', name: 'Audacious Charge (attack speed)',
      description: 'Gains attack speed for 5 seconds.',
      support: 'partial', supportNotes: 'The slow on cast is not modelled.',
      slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.45, 0.525, 0.6, 0.675] },
      durationSeconds: 5, cooldownSeconds: 0,
    }],
  },
  r: {
    id: 'xin-zhao-r', name: 'Crescent Guard', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100,
    castTime: 0, flags: {},
    // The knockback and the 5 s damage block on distant enemies are not modelled.
    damage: [physical({ byRank: [75, 150, 225] }, [
      { stat: 'bonusAd', value: 1 }, { stat: 'ap', value: 0.8 }, { stat: 'targetMaxHp', value: 0.15 },
    ])],
  },
})

const BRAND = modelled('brand', {
  passive: {
    id: 'brand-passive', name: 'Blaze', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'dot', id: 'brand-passive-ablaze', name: 'Ablaze',
      description: "Brand's abilities set enemies Ablaze, dealing 3% of their max Health as magic damage over 4 seconds.",
      support: 'partial',
      supportNotes: 'The detonation at 3 stacks (10% +0.02% AP max Health to nearby enemies) and every '
        + 'Blaze-conditional bonus (Sear stun, Pillar of Flame +30%, Conflagration spread, Pyroclasm slow) are not '
        + 'modelled.',
      damageType: 'magic', tickAmount: 0, tickIntervalSeconds: 4, durationSeconds: 4, refresh: 'refresh',
      appliedBy: ['q', 'w', 'e', 'r'], targetMaxHpRatio: 0.03, ratios: [],
    }],
  },
  q: {
    id: 'brand-q', name: 'Sear', maxRank: 4, cooldown: { byRank: [7.5, 7, 6.5, 6] }, cost: 50, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 120, 160, 200] }, [{ stat: 'ap', value: 0.55 }])],
  },
  w: {
    id: 'brand-w', name: 'Pillar of Flame', maxRank: 4, cooldown: { byRank: [9.5, 9, 8.5, 8] },
    cost: { byRank: [65, 75, 85, 95] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 120, 170, 220] }, [{ stat: 'ap', value: 0.55 }])],
  },
  e: {
    id: 'brand-e', name: 'Conflagration', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] },
    cost: { byRank: [65, 70, 75, 80] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 90, 120, 150] }, [{ stat: 'ap', value: 0.45 }])],
  },
  r: {
    id: 'brand-r', name: 'Pyroclasm', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    // Bounces up to 5 times between other enemies or Brand himself; against one target only the first bounce lands.
    damage: [magic({ byRank: [100, 200, 300] }, [{ stat: 'ap', value: 0.3 }])],
  },
})

const YUNARA = modelled('yunara', {
  // Vow of the First Lands (bonus magic damage on crit, 8% per 100 AP) needs a crit-triggered condition; not modelled.
  passive: utility('yunara-passive', 'Vow of the First Lands', 1, null),
  q: {
    id: 'yunara-q', name: 'Cultivation of Spirit', maxRank: 4, cooldown: 0, cost: 30, castTime: 0, flags: {},
    damage: [],
    effects: [
      {
        kind: 'onHit', id: 'yunara-q-spirit-charge', name: 'Spirit Charge',
        description: 'Attacks deal an additional 10 (+20% AP) magic damage.',
        support: 'full',
        damageType: 'magic', flat: { byRank: [10, 15, 20, 25] }, ratios: [{ stat: 'ap', value: 0.2 }],
      },
      {
        kind: 'empoweredAttack', id: 'yunara-q-spirit-unbound', name: 'Spirit Unbound',
        description: 'Consumes Unleash to empower attacks for 5 seconds, dealing an additional 10 (+20% AP) magic '
          + 'damage on-hit and spreading 30% AD physical damage to nearby enemies.',
        support: 'partial',
        supportNotes: 'The Unleash resource (needs a prior attack to generate a charge) and the splash to nearby '
          + 'enemies are not modelled; this assumes a charge is already banked.',
        grant: { on: 'abilityCast', slots: ['q'], charges: 99 }, maxCharges: 99, durationSeconds: 5,
        bonus: magic({ byRank: [10, 15, 20, 25] }, [{ stat: 'ap', value: 0.2 }]),
      },
      {
        kind: 'castBuff', id: 'yunara-q-attack-speed', name: 'Spirit Unbound (attack speed)',
        description: 'Gains attack speed for 5 seconds.',
        support: 'full',
        slots: ['q'], stat: 'attackSpeed', amount: { byRank: [0.25, 0.35, 0.45, 0.55] },
        durationSeconds: 5, cooldownSeconds: 0,
      },
    ],
  },
  w: {
    id: 'yunara-w', name: 'Arc of Judgment', maxRank: 4, cooldown: 10, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 110, 160, 210] }, [{ stat: 'bonusAd', value: 0.85 }, { stat: 'ap', value: 0.5 }])],
    effects: [{
      kind: 'dot', id: 'yunara-w-lingering-bead', name: 'Arc of Judgment (lingering)',
      description: 'While lingering, the bead deals an additional 8 (+12% bonus AD +7.5% AP) magic damage to nearby '
        + 'enemies every 0.25 seconds.',
      support: 'partial',
      supportNotes: 'How long the bead lingers is not stated (1 s assumed). The Transcendent-state upgrade (Arc of '
        + 'Ruin) is not modelled.',
      damageType: 'magic', tickAmount: 8, tickIntervalSeconds: 0.25, durationSeconds: 1, refresh: 'ignore',
      appliedBy: ['w'], ratios: [{ stat: 'ad', layer: 'bonus', value: 0.12 }, { stat: 'ap', value: 0.075 }],
    }],
  },
  // Kanmei's Steps is a move-speed buff (its Untouchable Shadow upgrade a dash); nothing to model one-on-one.
  e: utility('yunara-e', "Kanmei's Steps", 4, 9, 40),
  // Transcend One's Self is a 15 s state toggle with no direct damage of its own; the abilities it upgrades
  // (Arc of Ruin, Untouchable Shadow) are not modelled.
  r: utility('yunara-r', "Transcend One's Self", 3, { byRank: [70, 60, 50] }, 100),
})

const THRESH = modelled('thresh', {
  passive: {
    id: 'thresh-passive', name: 'Damnation', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'stacking', id: 'thresh-passive-souls-armor', name: 'Damnation (Armor)',
        description: 'Each Soul harvested permanently grants 2 Armor.',
        support: 'full',
        inputs: [{ type: 'stackCount', id: THRESH_SOULS, label: 'Thresh: Souls collected', min: 0, max: 40, default: 0 }],
        stat: 'armor', perStack: 2, maxStacks: 40, stackInputId: THRESH_SOULS,
      },
      {
        kind: 'stacking', id: 'thresh-passive-souls-ap', name: 'Damnation (Ability Power)',
        description: 'Each Soul harvested permanently grants 2 Ability Power.',
        support: 'full',
        stat: 'ap', perStack: 2, maxStacks: 40, stackInputId: THRESH_SOULS,
      },
    ],
  },
  q: {
    id: 'thresh-q', name: 'Death Sentence', maxRank: 4, cooldown: { byRank: [18, 15, 12, 9] }, cost: 70,
    castTime: 0, flags: {},
    // The stun, the pull and the dash recast are not modelled.
    damage: [magic({ byRank: [100, 160, 220, 280] }, [{ stat: 'ap', value: 0.8 }])],
  },
  // Dark Passage is a lantern shield/dash; nothing to model one-on-one.
  w: utility('thresh-w', 'Dark Passage', 4, { byRank: [21, 19, 17, 15] }, { byRank: [50, 55, 60, 65] }),
  e: {
    id: 'thresh-e', name: 'Flay', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] },
    cost: { byRank: [60, 65, 70, 75] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [75, 115, 155, 195] }, [{ stat: 'ap', value: 0.6 }])],
    effects: [{
      kind: 'onHit', id: 'thresh-e-flay-passive', name: 'Flay (passive)',
      description: 'Basic attacks deal an additional 2 per Soul (+80% AD) magic damage.',
      support: 'partial', supportNotes: 'The 2-per-Soul flat portion is not modelled (onHit has no per-stack input); only the AD ratio is.',
      damageType: 'magic', ratios: [{ stat: 'ad', value: { byRank: [0.8, 1.2, 1.6, 2] } }],
    }],
  },
  r: {
    id: 'thresh-r', name: 'The Box', maxRank: 3, cooldown: { byRank: [85, 80, 75] }, cost: 100, castTime: 0, flags: {},
    // Only the first wall's hit is modelled; later walls deal no damage per the ability's own text.
    damage: [magic({ byRank: [250, 400, 550] }, [{ stat: 'ap', value: 1 }])],
  },
})

/** The third most-picked champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH3: Champion[] = [GAREN, XIN_ZHAO, BRAND, YUNARA, THRESH]
