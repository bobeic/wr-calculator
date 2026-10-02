import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 7 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Nasus (Baron), Kha'Zix (Jungle), Akali (Mid), Draven (Dragon) and Blitzcrank (Support). Same approach as the
// earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const NASUS_STACKS = 'nasus-siphoning-strike-stacks'

const NASUS = modelled('nasus', {
  // Soul Eater is physical vamp; it heals rather than deals damage.
  passive: utility('nasus-passive', 'Soul Eater', 1, null),
  q: {
    ...utility('nasus-q', 'Siphoning Strike', 4, { byRank: [7, 6, 5, 4] }, 15),
    effects: [{
      kind: 'empoweredAttack', id: 'nasus-q-siphoning-strike', name: 'Siphoning Strike',
      description: 'Empowers the next attack within 10 seconds to deal an additional 20 physical damage, plus 1 per '
        + 'stack (5 per kill, 14 per champion/large kill).',
      support: 'partial',
      supportNotes: 'Stacks are an input. The halved cooldown during Fury of the Sands is not modelled.',
      inputs: [{ type: 'stackCount', id: NASUS_STACKS, label: 'Nasus: Siphoning Strike stacks', min: 0, max: 2000, default: 0 }],
      grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 1, durationSeconds: 10,
      bonus: { ...physical({ byRank: [20, 50, 80, 110] }, []), basePerInput: { inputId: NASUS_STACKS, value: 1 } },
    }],
  },
  // Wither slows; nothing to model one-on-one.
  w: utility('nasus-w', 'Wither', 4, { byRank: [14, 13, 12, 11] }, 80),
  e: {
    id: 'nasus-e', name: 'Spirit Fire', maxRank: 4, cooldown: 12, cost: { byRank: [110, 120, 130, 140] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [55, 110, 165, 220] }, [{ stat: 'ap', value: 0.4 }])],
    effects: [{
      kind: 'dot', id: 'nasus-e-spirit-fire-zone', name: 'Spirit Fire (zone)',
      description: 'The zone persists for 5 seconds, dealing 11 (+12% AP) magic damage over time and reducing Armor by 20%.',
      support: 'partial',
      supportNotes: 'The target stays in the zone for all 5 seconds (ticks once a second, assumed). The 20-35% Armor '
        + 'reduction is not modelled (only flat shreds are).',
      damageType: 'magic', tickAmount: { byRank: [11 / 5, 22 / 5, 33 / 5, 44 / 5] }, tickIntervalSeconds: 1,
      durationSeconds: 5, refresh: 'refresh', appliedBy: ['e'], ratios: [{ stat: 'ap', value: 0.12 / 5 }],
    }],
  },
  r: {
    id: 'nasus-r', name: 'Fury of the Sands', maxRank: 3, cooldown: { byRank: [90, 80, 70] }, cost: 100, castTime: 0, flags: {},
    // The first second's storm; the dot below deals the other 11.
    damage: [magic(0, [{ stat: 'targetMaxHp', value: { byRank: [0.03, 0.04, 0.05] }, perStat: { stat: 'ap', value: 0.0001 } }])],
    effects: [{
      kind: 'dot', id: 'nasus-r-storm', name: 'Fury of the Sands (storm)',
      description: "Deals magic damage to nearby enemies equal to 3% (+0.01% AP) of their max Health every second for "
        + '12 seconds, up to 240 per second.',
      support: 'partial',
      supportNotes: "The target stays in range for all 12 seconds. These 11 ticks leave out the AP part and the 240 cap "
        + "(the first tick, the ability's own damage, has the AP part). The Health, Armor and Magic Resist gain is not "
        + 'modelled.',
      damageType: 'magic', tickAmount: 0, tickIntervalSeconds: 1, durationSeconds: 11, refresh: 'refresh',
      appliedBy: ['r'], ratios: [], targetMaxHpRatio: { byRank: [0.03, 0.04, 0.05] },
    }],
  },
})

const KHAZIX = modelled('khazix', {
  passive: {
    id: 'khazix-passive', name: 'Unseen Threat', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'khazix-passive-unseen-threat', name: 'Unseen Threat',
      description: 'Enhances his next attack against enemy champions to deal an additional 23 (+50% bonus AD) magic damage.',
      support: 'partial',
      supportNotes: 'Once per combo: it only refreshes when the enemy team loses sight of him. The slow is not modelled.',
      triggeredBy: ['basicAttack'], damageType: 'magic', damage: 23, ratios: [{ stat: 'ad', layer: 'bonus', value: 0.5 }],
      cooldownSeconds: 0, oncePerCombo: true,
    }],
  },
  q: {
    id: 'khazix-q', name: 'Taste Their Fear', maxRank: 4, cooldown: { byRank: [5, 4.5, 4, 3.5] }, cost: 20, castTime: 0, flags: {},
    // Against an isolated target (+110%), the normal case one-on-one. Evolutions are not modelled.
    damage: [physical({ byRank: [75 * 2.1, 110 * 2.1, 145 * 2.1, 180 * 2.1] }, [{ stat: 'bonusAd', value: 1.3 * 2.1 }])],
  },
  w: {
    id: 'khazix-w', name: 'Void Spike', maxRank: 4, cooldown: 9, cost: { byRank: [55, 60, 65, 70] }, castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 110, 150, 190] }, [{ stat: 'bonusAd', value: 1 }])],
  },
  e: {
    id: 'khazix-e', name: 'Leap', maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: 50, castTime: 0, flags: {},
    damage: [physical({ byRank: [65, 110, 155, 200] }, [{ stat: 'bonusAd', value: 0.2 }])],
  },
  // Void Assault is stealth and evolutions; it deals no damage of its own.
  r: utility('khazix-r', 'Void Assault', 3, { byRank: [75, 65, 55] }, 100),
})

// Akali uses Energy, not Mana, so her costs are left out.
const AKALI = modelled('akali', {
  passive: {
    id: 'akali-passive', name: "Assassin's Mark", maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'spellblade', id: 'akali-passive-assassins-mark', name: "Assassin's Mark",
      description: "Dealing ability damage to a champion reveals a ring; crossing it empowers Akali's next attack to "
        + 'deal 37 (based on level) (+60% bonus AD +65% AP) bonus magic damage.',
      support: 'partial',
      supportNotes: "She is assumed to cross the ring every time, so it acts like a spellblade. The level scaling isn't "
        + 'stated beyond "37 (based on level)", so 37 is used at every level.',
      damageType: 'magic', bonusDamage: 37,
      ratios: [{ stat: 'ad', layer: 'bonus', value: 0.6 }, { stat: 'ap', value: 0.65 }], internalCooldownSeconds: 0,
    }],
  },
  q: {
    id: 'akali-q', name: 'Five Point Strike', maxRank: 4, cooldown: 1.5, castTime: 0, flags: {},
    damage: [magic({ byRank: [35, 70, 105, 140] }, [{ stat: 'totalAd', value: 0.65 }, { stat: 'ap', value: 0.6 }])],
  },
  // Twilight Shroud is stealth; it deals no damage.
  w: utility('akali-w', 'Twilight Shroud', 4, { byRank: [18, 17, 16, 15] }),
  e: {
    id: 'akali-e', name: 'Shuriken Flip', maxRank: 4, cooldown: { byRank: [15, 13, 11, 9] }, castTime: 0, flags: {},
    // The recast dash is folded into the first cast.
    damage: [
      magic({ byRank: [30, 60, 90, 120] }, [{ stat: 'totalAd', value: 0.25 }, { stat: 'ap', value: 0.3 }]),
      magic({ byRank: [60, 125, 190, 255] }, [{ stat: 'totalAd', value: 0.5 }, { stat: 'ap', value: 0.8 }]),
    ],
  },
  r: {
    id: 'akali-r', name: 'Perfect Execution', maxRank: 3, cooldown: { byRank: [85, 65, 45] }, castTime: 0, flags: {},
    // Both casts folded into one (the 2.5 second wait isn't modelled). The second cast's 70-210 (+30-90% AP) by
    // missing Health is taken as a straight line to full damage at 100% missing Health (the text maxes it below 35%
    // Health), and its extra AP is left out.
    damage: [
      magic({ byRank: [80, 200, 320] }, [{ stat: 'bonusAd', value: 0.5 }, { stat: 'ap', value: 0.3 }]),
      magic({ byRank: [70, 140, 210] }, [{ stat: 'ap', value: 0.3 }, { stat: 'targetMissingHpFraction', value: { byRank: [140, 280, 420] } }]),
    ],
  },
})

const DRAVEN = modelled('draven', {
  // League of Draven is gold and an execute threshold from Adoration; nothing to model one-on-one.
  passive: utility('draven-passive', 'League of Draven', 1, null),
  q: {
    ...utility('draven-q', 'Spinning Axe', 4, { byRank: [10, 9, 8, 7] }, 45),
    effects: [{
      kind: 'empoweredAttack', id: 'draven-q-spinning-axe', name: 'Spinning Axe',
      description: 'His next attack within 6 seconds deals an additional 45 (+90% bonus AD) physical damage. He can '
        + 'hold 2 axes.',
      support: 'partial',
      supportNotes: 'Each cast empowers one attack: catching axes to keep them going is not modelled, so juggling '
        + 'Draven deals more than this.',
      grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 2, durationSeconds: 6,
      bonus: physical({ byRank: [45, 50, 55, 60] }, [{ stat: 'bonusAd', value: { byRank: [0.9, 1, 1.1, 1.2] } }]),
    }],
  },
  w: {
    ...utility('draven-w', 'Blood Rush', 4, 10, { byRank: [40, 35, 30, 25] }),
    effects: [{
      kind: 'castBuff', id: 'draven-w-blood-rush', name: 'Blood Rush',
      description: 'Gains bonus Attack Speed for 3 seconds.', support: 'full',
      slots: ['w'], stat: 'attackSpeed', amount: { byRank: [0.25, 0.3, 0.35, 0.4] }, durationSeconds: 3, cooldownSeconds: 0,
    }],
  },
  e: {
    id: 'draven-e', name: 'Stand Aside', maxRank: 4, cooldown: { byRank: [15, 14, 13, 12] }, cost: 70, castTime: 0, flags: {},
    damage: [physical({ byRank: [75, 120, 165, 210] }, [{ stat: 'bonusAd', value: 0.5 }])],
  },
  r: {
    id: 'draven-r', name: 'Whirling Death', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    // Read as hitting on the way out and again on the way back (full damage after reversal), both at once. The
    // Adoration execute is not modelled.
    damage: [{ ...physical({ byRank: [200, 300, 400] }, [{ stat: 'bonusAd', value: 1.5 }]), hits: 2 }],
  },
})

const BLITZCRANK = modelled('blitzcrank', {
  // Mana Barrier is a shield.
  passive: utility('blitzcrank-passive', 'Mana Barrier', 1, null),
  q: {
    id: 'blitzcrank-q', name: 'Rocket Grab', maxRank: 4, cooldown: { byRank: [18, 17, 16, 15] }, cost: 80, castTime: 0, flags: {},
    damage: [magic({ byRank: [110, 175, 240, 305] }, [{ stat: 'ap', value: 1 }])],
  },
  // Overdrive is movement speed.
  w: utility('blitzcrank-w', 'Overdrive', 4, 10, 75),
  e: {
    ...utility('blitzcrank-e', 'Power Fist', 4, { byRank: [8, 7, 6, 5] }, 25),
    effects: [{
      kind: 'empoweredAttack', id: 'blitzcrank-e-power-fist', name: 'Power Fist',
      description: 'Empowers his next attack to critically strike for 180% AD physical damage and knock up the target.',
      support: 'partial',
      supportNotes: 'Read as the attack plus 80-140% AD (by rank), not as a crit (crit items do not change it). How '
        + 'long the empower lasts unused is not stated (5s assumed).',
      grant: { on: 'abilityCast', slots: ['e'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
      bonus: physical(0, [{ stat: 'totalAd', value: { byRank: [0.8, 1, 1.2, 1.4] } }]),
    }],
  },
  r: {
    id: 'blitzcrank-r', name: 'Static Field', maxRank: 3, cooldown: { byRank: [55, 35, 15] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [275, 400, 525] }, [{ stat: 'ap', value: 0.8 }])],
    effects: [{
      kind: 'onHit', id: 'blitzcrank-r-static-field-mark', name: 'Static Field (passive)',
      description: 'While Static Field is off cooldown, attacks mark enemies to deal 40 (+15% AP) magic damage after 1 second.',
      support: 'partial',
      supportNotes: 'Every attack, at once (the 1 second delay is not modelled), including while Static Field is on '
        + 'cooldown.',
      damageType: 'magic', flat: { byRank: [40, 80, 120] }, ratios: [{ stat: 'ap', value: 0.15 }],
    }],
  },
})

/** The seventh batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH7: Champion[] = [NASUS, KHAZIX, AKALI, DRAVEN, BLITZCRANK]
