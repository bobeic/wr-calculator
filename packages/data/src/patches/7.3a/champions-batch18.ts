import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 18 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Gwen (Baron), Rengar (Jungle), Viktor (Mid), Xayah (Dragon) and Karma (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const GWEN = modelled('gwen', {
  passive: {
    id: 'gwen-passive', name: 'Thousand Cuts', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'onHit', id: 'gwen-passive-thousand-cuts', name: 'Thousand Cuts',
      description: "Attacks deal bonus magic damage equal to 1% (+0.005% per AP) of the target's max Health.",
      support: 'partial', supportNotes: 'The +0.005% per AP and the heal are not modelled.',
      damageType: 'magic', pctTargetMaxHp: 0.01,
    }],
  },
  q: {
    id: 'gwen-q', name: 'Snip Snip!', maxRank: 4, cooldown: { byRank: [6.5, 5.5, 4.5, 3.5] }, cost: 35, castTime: 0, flags: {},
    // With 4 stacks (from 4 attacks): 5 snips plus the final one, all at once. The true damage at the centre and
    // each snip applying Thousand Cuts are not modelled.
    damage: [
      { ...magic({ byRank: [14, 18, 22, 26] }, [{ stat: 'ap', value: 0.06 }]), hits: 5 },
      magic({ byRank: [70, 90, 110, 130] }, [{ stat: 'ap', value: 0.3 }]),
    ],
  },
  // Hallowed Mist is untargetability and resists.
  w: utility('gwen-w', 'Hallowed Mist', 4, { byRank: [17, 16, 15, 14] }, 60),
  e: {
    ...utility('gwen-e', "Skip 'n Slash", 4, { byRank: [13.5, 12, 10.5, 9] }, 35),
    effects: [
      {
        kind: 'castBuff', id: 'gwen-e-attack-speed', name: "Skip 'n Slash",
        description: 'Enhanced attacks gain 20% Attack Speed for 4 seconds.', support: 'full',
        slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.2, 0.4, 0.6, 0.8] }, durationSeconds: 4, cooldownSeconds: 0,
      },
      {
        kind: 'empoweredAttack', id: 'gwen-e-on-hit', name: "Skip 'n Slash (on-hit)",
        description: 'For 4 seconds, attacks deal 10 (+18% AP) magic damage on-hit.',
        support: 'partial', supportNotes: 'The 50% cooldown refund on the first hit is not modelled.',
        grant: { on: 'abilityCast', slots: ['e'], charges: 99 }, maxCharges: 99, durationSeconds: 4,
        bonus: magic(10, [{ stat: 'ap', value: 0.18 }]),
      },
    ],
  },
  r: {
    id: 'gwen-r', name: 'Needlework', maxRank: 3, cooldown: { byRank: [75, 65, 55] }, cost: 100, castTime: 0, flags: {},
    // All three casts at once: 1 + 3 + 5 needles of 35 (+10% AP). Thousand Cuts on each is not modelled.
    damage: [{ ...magic({ byRank: [35, 50, 65] }, [{ stat: 'ap', value: 0.1 }]), hits: 9 }],
  },
})

const RENGAR = modelled('rengar', {
  // Unseen Predator's leap and Ferocity (the empowered abilities) are not modelled.
  passive: utility('rengar-passive', 'Unseen Predator', 1, null),
  q: {
    ...utility('rengar-q', 'Savagery', 4, { byRank: [5.5, 5, 4.5, 4] }),
    effects: [
      {
        kind: 'empoweredAttack', id: 'rengar-q-savagery', name: 'Savagery',
        description: 'The first attack is empowered to deal an additional 40 (+5% AD) physical damage and will '
          + 'Critically Strike.',
        support: 'partial',
        supportNotes: "The crit and Critical Rate's 0-80% extra are not modelled. How long it lasts unused is 3s.",
        grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 1, durationSeconds: 3,
        bonus: physical({ byRank: [40, 80, 120, 160] }, [{ stat: 'totalAd', value: { byRank: [0.05, 0.1, 0.15, 0.2] } }]),
      },
      {
        kind: 'empoweredAttack', id: 'rengar-q-attack-speed', name: 'Savagery (attack speed)',
        description: 'The next 2 attacks within 3 seconds gain 40% Attack Speed.', support: 'full',
        grant: { on: 'abilityCast', slots: ['q'], charges: 2 }, maxCharges: 2, durationSeconds: 3, attackSpeedBonus: 0.4,
        bonus: physical(0, []),
      },
    ],
  },
  w: {
    id: 'rengar-w', name: 'Battle Roar', maxRank: 4, cooldown: { byRank: [16, 14, 12, 10] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 100, 140, 180] }, [{ stat: 'ap', value: 0.8 }])],
  },
  e: {
    id: 'rengar-e', name: 'Bola Strike', maxRank: 4, cooldown: 10, castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 130, 190, 250] }, [{ stat: 'bonusAd', value: 0.7 }])],
  },
  // Thrill of the Hunt is camouflage; the flat Armor shred on the leap is not modelled.
  r: utility('rengar-r', 'Thrill of the Hunt', 3, { byRank: [85, 75, 65] }),
})

const VIKTOR = modelled('viktor', {
  // Glorious Evolution's upgrades need Hex Fragments; not modelled (base abilities only).
  passive: utility('viktor-passive', 'Glorious Evolution', 1, null),
  q: {
    id: 'viktor-q', name: 'Siphon Power', maxRank: 4, cooldown: { byRank: [8, 7, 6, 5] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [45, 60, 75, 90] }, [{ stat: 'ap', value: 0.3 }])],
    effects: [{
      kind: 'empoweredAttack', id: 'viktor-q-empowered', name: 'Siphon Power (empowered attack)',
      description: 'The next attack within 3.5 seconds deals 20 (+100% AD +40% AP) bonus magic damage.',
      support: 'partial', supportNotes: 'The shield is not modelled.',
      grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 1, durationSeconds: 3.5,
      bonus: magic({ byRank: [20, 40, 60, 80] }, [{ stat: 'totalAd', value: 1 }, { stat: 'ap', value: 0.4 }]),
    }],
  },
  // Gravity Field slows and stuns.
  w: utility('viktor-w', 'Gravity Field', 4, { byRank: [13, 12, 11, 10] }, 65),
  e: {
    id: 'viktor-e', name: 'Hextech Ray', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: { byRank: [60, 70, 80, 90] },
    castTime: 0, flags: {},
    // The un-upgraded beam (Blastquake's follow-up needs the upgrade).
    damage: [magic({ byRank: [75, 120, 165, 210] }, [{ stat: 'ap', value: 0.3 }])],
  },
  r: {
    id: 'viktor-r', name: 'Arcane Storm', maxRank: 3, cooldown: { byRank: [75, 65, 55] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [100, 175, 250] }, [{ stat: 'ap', value: 0.6 }])],
    effects: [{
      kind: 'dot', id: 'viktor-r-storm', name: 'Arcane Storm',
      description: 'The storm then deals 50 (+40% AP) magic damage to enemies within it every second (5.5 seconds in all).',
      support: 'partial', supportNotes: 'The target stays in the storm: 5 ticks after the initial hit.',
      damageType: 'magic', tickAmount: { byRank: [50, 90, 130] }, tickIntervalSeconds: 1, durationSeconds: 5,
      refresh: 'refresh', appliedBy: ['r'], ratios: [{ stat: 'ap', value: 0.4 }],
    }],
  },
})

const XAYAH = modelled('xayah', {
  // Clean Cuts makes attacks pierce and drop Feathers; one target takes nothing extra.
  passive: utility('xayah-passive', 'Clean Cuts', 1, null),
  q: {
    id: 'xayah-q', name: 'Double Daggers', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: 50, castTime: 0, flags: {},
    // Both daggers hit the target.
    damage: [{ ...physical({ byRank: [50, 75, 100, 125] }, [{ stat: 'bonusAd', value: 0.5 }]), hits: 2 }],
  },
  w: {
    ...utility('xayah-w', 'Deadly Plumage', 4, { byRank: [17, 16, 15, 14] }, 50),
    effects: [
      {
        kind: 'castBuff', id: 'xayah-w-attack-speed', name: 'Deadly Plumage',
        description: 'For 4 seconds, grants 40% Attack Speed.', support: 'full',
        slots: ['w'], stat: 'attackSpeed', amount: { byRank: [0.4, 0.45, 0.5, 0.55] }, durationSeconds: 4, cooldownSeconds: 0,
      },
      {
        kind: 'empoweredAttack', id: 'xayah-w-damage', name: 'Deadly Plumage (damage)',
        description: 'For 4 seconds, attacks deal 25% more damage.',
        support: 'partial', supportNotes: 'Read as +25% AD on each attack (not 25% of on-hit effects too).',
        grant: { on: 'abilityCast', slots: ['w'], charges: 99 }, maxCharges: 99, durationSeconds: 4,
        bonus: physical(0, [{ stat: 'totalAd', value: 0.25 }]),
      },
    ],
  },
  e: {
    id: 'xayah-e', name: 'Bladecaller', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] }, cost: 40, castTime: 0, flags: {},
    // 3 Feathers pass through the target (enough to root it). Its crit scaling is not modelled.
    damage: [{ ...physical({ byRank: [70, 80, 90, 100] }, [{ stat: 'bonusAd', value: 0.5 }]), hits: 3 }],
  },
  r: {
    id: 'xayah-r', name: 'Featherstorm', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [physical({ byRank: [150, 250, 350] }, [{ stat: 'bonusAd', value: 1 }])],
  },
})

const KARMA = modelled('karma', {
  // Mantra's empowered abilities are not modelled (base abilities only).
  passive: utility('karma-passive', 'Mantra', 1, null),
  q: {
    id: 'karma-q', name: 'Inner Flame', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 100, 140, 180] }, [{ stat: 'ap', value: 0.4 }])],
  },
  w: {
    id: 'karma-w', name: 'Focused Resolve', maxRank: 4, cooldown: 15, cost: { byRank: [55, 60, 65, 70] }, castTime: 0, flags: {},
    // The tether and its root (the target is assumed not to break it), both at once.
    damage: [
      magic({ byRank: [35, 60, 85, 110] }, [{ stat: 'ap', value: 0.4 }]),
      magic({ byRank: [40, 70, 100, 130] }, [{ stat: 'ap', value: 0.45 }]),
    ],
  },
  // Inspire shields an ally.
  e: utility('karma-e', 'Inspire', 4, { byRank: [10, 9, 8, 7] }, 70),
  r: {
    id: 'karma-r', name: 'Transcendent Embrace', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [170, 280, 390] }, [{ stat: 'ap', value: 0.8 }])],
  },
})

/** The eighteenth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH18: Champion[] = [GWEN, RENGAR, VIKTOR, XAYAH, KARMA]
