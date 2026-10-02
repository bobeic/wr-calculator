import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 22 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Camille (Baron), Evelynn (Jungle), Fizz (Mid) and Sona (Support); every Dragon-lane pick is already modelled. Same
// approach as the earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing
// checked in game yet.

const CAMILLE = modelled('camille', {
  // Adaptive Defenses is a shield.
  passive: utility('camille-passive', 'Adaptive Defenses', 1, null),
  q: {
    ...utility('camille-q', 'Precision Protocol', 4, { byRank: [9, 8, 7, 6] }, 25),
    effects: [{
      kind: 'empoweredAttack', id: 'camille-q-precision-protocol', name: 'Precision Protocol',
      description: 'Empowers the next attack to deal 130% AD physical damage; 1.6 seconds later another attack is empowered.',
      support: 'partial',
      supportNotes: "Both attacks get the +30% AD at once (the second doesn't wait 1.6 seconds), and the second one's "
        + 'true damage conversion is not modelled. How long they wait unused is 3.5s.',
      grant: { on: 'abilityCast', slots: ['q'], charges: 2 }, maxCharges: 2, durationSeconds: 3.5,
      bonus: physical(0, [{ stat: 'totalAd', value: { byRank: [0.3, 0.4, 0.5, 0.6] } }]),
    }],
  },
  w: {
    id: 'camille-w', name: 'Tactical Sweep', maxRank: 4, cooldown: { byRank: [15, 13, 11, 9] }, cost: 50, castTime: 0, flags: {},
    damage: [physical({ byRank: [100, 130, 160, 190] }, [
      { stat: 'bonusAd', value: 1.1 }, { stat: 'targetMaxHp', value: { byRank: [0.03, 0.05, 0.07, 0.09] } },
    ])],
  },
  e: {
    id: 'camille-e', name: 'Hookshot', maxRank: 4, cooldown: { byRank: [22, 20, 18, 16] }, cost: 70, castTime: 0, flags: {},
    damage: [physical({ byRank: [60, 110, 160, 210] }, [{ stat: 'bonusAd', value: 0.75 }])],
    effects: [{
      kind: 'castBuff', id: 'camille-e-attack-speed', name: 'Hookshot',
      description: 'The next attack within 3 seconds grants 50% Attack Speed for 5 seconds.',
      support: 'partial', supportNotes: 'Granted on the cast rather than on the next attack.',
      slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.5, 0.6, 0.7, 0.8] }, durationSeconds: 5, cooldownSeconds: 0,
    }],
  },
  r: {
    id: 'camille-r', name: 'The Hextech Ultimatum', maxRank: 3, cooldown: { byRank: [90, 80, 70] }, cost: 100, castTime: 0, flags: {},
    damage: [magic(30, [{ stat: 'targetCurrentHp', value: { byRank: [0.15, 0.2, 0.25] } }])],
  },
})

const EVELYNN = modelled('evelynn', {
  // Demon Shade is regeneration and camouflage.
  passive: utility('evelynn-passive', 'Demon Shade', 1, null),
  q: {
    id: 'evelynn-q', name: 'Hate Spike', maxRank: 4, cooldown: 4, cost: { byRank: [30, 35, 40, 45] }, castTime: 0, flags: {},
    // Both lines of spikes hit the target; the recast isn't modelled.
    damage: [{ ...magic({ byRank: [40, 47.5, 55, 62.5] }, [{ stat: 'ap', value: 0.5 }]), hits: 2 }],
  },
  // Allure is a charm; its Magic Resist shred is not modelled.
  w: utility('evelynn-w', 'Allure', 4, { byRank: [14, 13, 12, 11] }, { byRank: [70, 80, 90, 100] }),
  e: {
    id: 'evelynn-e', name: 'Whiplash', maxRank: 4, cooldown: 8, cost: { byRank: [45, 50, 55, 60] }, castTime: 0, flags: {},
    // The un-empowered whip (no Demon Shade).
    damage: [magic({ byRank: [55, 75, 95, 115] }, [{ stat: 'targetMaxHp', value: 0.02, perStat: { stat: 'ap', value: 0.0001 } }])],
  },
  r: {
    id: 'evelynn-r', name: 'Last Caress', maxRank: 3, cooldown: { byRank: [90, 75, 60] }, cost: 100, castTime: 0, flags: {},
    // The 230% against champions below 35% Health is not modelled.
    damage: [magic({ byRank: [150, 260, 370] }, [{ stat: 'ap', value: 0.75 }])],
  },
})

const FIZZ = modelled('fizz', {
  passive: {
    id: 'fizz-passive', name: 'Seastone Trident', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'dot', id: 'fizz-passive-seastone-trident', name: 'Seastone Trident',
      description: 'Attacks deal an additional 24 (based on level) (+45% AP) magic damage over 3 seconds.',
      support: 'partial', supportNotes: '24 at every level (the scaling is not stated); three one-second ticks.',
      damageType: 'magic', tickAmount: 8, tickIntervalSeconds: 1, durationSeconds: 3,
      refresh: 'refresh', appliedBy: ['basicAttack'], ratios: [{ stat: 'ap', value: 0.15 }],
    }],
  },
  q: {
    id: 'fizz-q', name: 'Urchin Strike', maxRank: 4, cooldown: { byRank: [8, 7.5, 7, 6.5] }, cost: 50, castTime: 0,
    flags: { appliesOnHit: true },
    // The calculator doesn't apply on-hit effects from abilities yet.
    damage: [
      magic({ byRank: [20, 40, 60, 80] }, [{ stat: 'ap', value: 0.6 }]),
      physical(0, [{ stat: 'totalAd', value: 1 }]),
    ],
  },
  w: {
    ...utility('fizz-w', 'Rending Wave', 4, { byRank: [10, 9.5, 9, 8.5] }, { byRank: [30, 40, 50, 60] }),
    effects: [
      {
        kind: 'empoweredAttack', id: 'fizz-w-rending-wave', name: 'Rending Wave',
        description: 'Empowers the next attack to deal 50 (+45% AP) bonus magic damage.',
        support: 'full',
        grant: { on: 'abilityCast', slots: ['w'], charges: 1 }, maxCharges: 1, durationSeconds: 5,
        bonus: magic({ byRank: [50, 75, 100, 125] }, [{ stat: 'ap', value: 0.45 }]),
      },
      {
        kind: 'empoweredAttack', id: 'fizz-w-follow-up', name: 'Rending Wave (follow-up)',
        description: 'Additional attacks within 5 seconds deal 10 (+40% AP) bonus magic damage.',
        support: 'partial', supportNotes: 'The first attack gets this too.',
        grant: { on: 'abilityCast', slots: ['w'], charges: 99 }, maxCharges: 99, durationSeconds: 5,
        bonus: magic({ byRank: [10, 15, 20, 25] }, [{ stat: 'ap', value: 0.4 }]),
      },
    ],
  },
  e: {
    id: 'fizz-e', name: 'Playful / Trickster', maxRank: 4, cooldown: { byRank: [16, 14, 12, 10] }, cost: { byRank: [85, 90, 95, 100] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 150, 220, 290] }, [{ stat: 'ap', value: 0.8 }])],
  },
  r: {
    id: 'fizz-r', name: 'Chum the Waters', maxRank: 3, cooldown: { byRank: [85, 70, 55] }, cost: 100, castTime: 0, flags: {},
    // The largest shark (the fish travels its full range).
    damage: [magic({ byRank: [300, 400, 500] }, [{ stat: 'ap', value: 1.2 }])],
  },
})

const SONA = modelled('sona', {
  // Power Chord's empowered attack after 3 basic abilities is not modelled.
  passive: utility('sona-passive', 'Power Chord', 1, null),
  q: {
    id: 'sona-q', name: 'Hymn of Valor', maxRank: 4, cooldown: 8, cost: { byRank: [60, 65, 70, 75] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [40, 80, 120, 160] }, [{ stat: 'ap', value: 0.4 }])],
    effects: [{
      kind: 'empoweredAttack', id: 'sona-q-aura', name: 'Hymn of Valor (aura)',
      description: 'For 3 seconds, the next attack deals an additional 8 (+20% AP) magic damage.',
      support: 'partial', supportNotes: "Sona's own attack; the empowered aura's 1.2x (after Crescendo) is not modelled.",
      grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 1, durationSeconds: 3,
      bonus: magic({ byRank: [8, 13, 18, 23] }, [{ stat: 'ap', value: 0.2 }]),
    }],
  },
  // Aria of Perseverance heals and shields.
  w: utility('sona-w', 'Aria of Perseverance', 4, 10, { byRank: [85, 90, 95, 100] }),
  // Song of Celerity is movement speed.
  e: utility('sona-e', 'Song of Celerity', 4, 14, 80),
  r: {
    id: 'sona-r', name: 'Crescendo', maxRank: 3, cooldown: { byRank: [80, 75, 70] }, cost: 100, castTime: 0, flags: {},
    // One soundwave hits the target.
    damage: [magic({ byRank: [35, 60, 85] }, [{ stat: 'ap', value: 0.15 }])],
  },
})

/** The twenty-second batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH22: Champion[] = [CAMILLE, EVELYNN, FIZZ, SONA]
