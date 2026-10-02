import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 20 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Riven (Baron), Lillia (Jungle), Vel'Koz (Mid), Kog'Maw (Dragon) and Rell (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const RIVEN_BLADE_OF_THE_EXILE = 'riven-blade-of-the-exile-active'

const RIVEN = modelled('riven', {
  passive: {
    id: 'riven-passive', name: 'Runic Blade', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'empoweredAttack', id: 'riven-passive-runic-blade', name: 'Runic Blade',
        description: 'Abilities charge her blade up to 3 times. Attacks expend charges to deal 22% AD bonus physical damage.',
        support: 'partial',
        supportNotes: "Broken Wings gives 3 charges (one per slash), the other abilities 1. How long charges last isn't "
          + 'stated (6 seconds assumed). 22% at every level.',
        grant: { on: 'abilityCast', slots: ['w', 'e', 'r'], charges: 1 }, maxCharges: 3, durationSeconds: 6,
        bonus: physical(0, [{ stat: 'totalAd', value: 0.22 }]),
      },
    ],
  },
  q: {
    id: 'riven-q', name: 'Broken Wings', maxRank: 4, cooldown: 12, castTime: 0, flags: {},
    // All three slashes at once.
    damage: [{ ...physical({ byRank: [30, 55, 80, 105] }, [{ stat: 'totalAd', value: { byRank: [0.55, 0.6, 0.65, 0.7] } }]), hits: 3 }],
    effects: [{
      kind: 'empoweredAttack', id: 'riven-q-runic-blade', name: 'Runic Blade (Broken Wings)',
      description: 'Each slash of Broken Wings charges her blade once (up to 3).',
      support: 'partial', supportNotes: "Its own charge pool, so with other abilities she can hold more than 3.",
      grant: { on: 'abilityCast', slots: ['q'], charges: 3 }, maxCharges: 3, durationSeconds: 6,
      bonus: physical(0, [{ stat: 'totalAd', value: 0.22 }]),
    }],
  },
  w: {
    id: 'riven-w', name: 'Ki Burst', maxRank: 4, cooldown: { byRank: [8.5, 8, 7.5, 7] }, castTime: 0, flags: {},
    damage: [physical({ byRank: [55, 95, 135, 175] }, [{ stat: 'bonusAd', value: 1 }])],
  },
  // Valor is a dash and a shield.
  e: utility('riven-e', 'Valor', 4, { byRank: [9, 8, 7, 6] }),
  r: {
    id: 'riven-r', name: 'Blade of the Exile', maxRank: 3, cooldown: { byRank: [75, 60, 45] }, castTime: 0, flags: {},
    // Wind Slash: from 100 (+60% bonus AD) up to 3x with missing Health, read as a straight line on the base only.
    damage: [physical({ byRank: [100, 150, 200] }, [
      { stat: 'bonusAd', value: 0.6 }, { stat: 'targetMissingHpFraction', value: { byRank: [200, 300, 400] } },
    ])],
    effects: [{
      kind: 'statMultiplier', id: 'riven-r-blade-of-the-exile', name: 'Blade of the Exile',
      description: 'For 12 seconds, gains 25% Attack Damage.',
      support: 'partial',
      supportNotes: 'A toggle says whether it is active for the whole combo; casting R does not switch it on.',
      inputs: [{ type: 'boolean', id: RIVEN_BLADE_OF_THE_EXILE, label: 'Riven: Blade of the Exile active', default: false }],
      condition: { type: 'toggle', inputId: RIVEN_BLADE_OF_THE_EXILE },
      stat: 'ad', layer: 'total', amount: 0.25,
    }],
  },
})

const LILLIA = modelled('lillia', {
  passive: {
    id: 'lillia-passive', name: 'Dream-Laden Bough', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'dot', id: 'lillia-passive-dream-dust', name: 'Dream Dust',
      description: "Abilities apply Dream Dust, dealing 6% (+0.012% AP) max Health magic damage over 3 seconds.",
      support: 'partial', supportNotes: 'Three 2% ticks; the +0.012% per AP and the heal are not modelled.',
      damageType: 'magic', tickAmount: 0, targetMaxHpRatio: 0.02, tickIntervalSeconds: 1, durationSeconds: 3,
      refresh: 'refresh', ratios: [],
    }],
  },
  q: {
    id: 'lillia-q', name: 'Blooming Blows', maxRank: 4, cooldown: { byRank: [5.5, 5, 4.5, 4] }, cost: 65, castTime: 0, flags: {},
    // The target is at the outer edge (magic plus true).
    damage: [
      magic({ byRank: [35, 55, 75, 95] }, [{ stat: 'ap', value: 0.4 }]),
      { type: 'true', base: { byRank: [35, 55, 75, 95] }, ratios: [{ stat: 'ap', value: 0.4 }], tags: [] },
    ],
  },
  w: {
    id: 'lillia-w', name: 'Watch Out! Eep!', maxRank: 4, cooldown: { byRank: [14, 13, 12, 11] }, cost: 65, castTime: 0, flags: {},
    // The target is in the centre.
    damage: [magic({ byRank: [140, 220, 300, 380] }, [{ stat: 'ap', value: 0.7 }])],
  },
  e: {
    id: 'lillia-e', name: 'Swirlseed', maxRank: 4, cooldown: 15, cost: 70, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 105, 140, 175] }, [{ stat: 'ap', value: 0.45 }])],
  },
  r: {
    id: 'lillia-r', name: 'Lilting Lullaby', maxRank: 3, cooldown: { byRank: [100, 85, 70] }, cost: 50, castTime: 0, flags: {},
    // The wake-up damage, dealt at once (the sleep delay is not modelled).
    damage: [magic({ byRank: [100, 150, 200] }, [{ stat: 'ap', value: 0.4 }])],
  },
})

const VELKOZ = modelled('velkoz', {
  passive: {
    id: 'velkoz-passive', name: 'Organic Deconstruction', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'hitStackProc', id: 'velkoz-passive-deconstruction', name: 'Organic Deconstruction',
      description: 'Enemies with 3 stacks of Deconstruction (from abilities, for 7 seconds) take 20 + 8 (based on level) '
        + '(+45% AP) true damage.',
      support: 'partial', supportNotes: 'Read as 20 + 8 per level. Attacks refreshing the stacks is not modelled.',
      stacksToProc: 3, stackWindowSeconds: 7, cooldownSeconds: 0, stacksFrom: ['ability'],
      damage: { type: 'true', base: { byLevel: Array.from({ length: 15 }, (_, index) => 28 + 8 * index) }, ratios: [{ stat: 'ap', value: 0.45 }], tags: [] },
      delivery: { kind: 'instant' },
    }],
  },
  q: {
    id: 'velkoz-q', name: 'Plasma Fission', maxRank: 4, cooldown: 7, cost: { byRank: [40, 45, 50, 55] }, castTime: 0, flags: {},
    // The first bolt; the split bolts go elsewhere.
    damage: [magic({ byRank: [80, 135, 190, 245] }, [{ stat: 'ap', value: 0.75 }])],
  },
  w: {
    id: 'velkoz-w', name: 'Void Rift', maxRank: 4, cooldown: 1.5, cost: { byRank: [50, 55, 60, 65] }, castTime: 0, flags: {},
    // Both hits at once; the 2 charges are not modelled (the 1.5s cooldown between casts is).
    damage: [
      magic({ byRank: [30, 60, 90, 120] }, [{ stat: 'ap', value: 0.2 }]),
      magic({ byRank: [45, 85, 125, 165] }, [{ stat: 'ap', value: 0.25 }]),
    ],
  },
  e: {
    id: 'velkoz-e', name: 'Tectonic Disruption', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 110, 150, 190] }, [{ stat: 'ap', value: 0.3 }])],
  },
  r: {
    id: 'velkoz-r', name: 'Life Form Disintegration Ray', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // The whole ray at once, as magic damage (true damage on Researched targets is not modelled).
    damage: [magic({ byRank: [450, 625, 800] }, [{ stat: 'ap', value: 1.25 }])],
  },
})

const KOGMAW = modelled('kogmaw', {
  // Icathian Surprise happens after death.
  passive: utility('kogmaw-passive', 'Icathian Surprise', 1, null),
  q: {
    id: 'kogmaw-q', name: 'Caustic Spittle', maxRank: 4, cooldown: 6, cost: 40, castTime: 0, flags: {},
    // The 20% Armor and Magic Resist shred is not modelled.
    damage: [magic({ byRank: [90, 150, 210, 270] }, [{ stat: 'ap', value: 0.65 }])],
  },
  w: {
    ...utility('kogmaw-w', 'Bio-Arcane Barrage', 4, 16, 40),
    effects: [{
      kind: 'empoweredAttack', id: 'kogmaw-w-barrage', name: 'Bio-Arcane Barrage',
      description: 'For 8 seconds, attacks deal an additional 1.5% (+0.01% AP) max Health as magic damage.',
      support: 'full',
      grant: { on: 'abilityCast', slots: ['w'], charges: 99 }, maxCharges: 99, durationSeconds: 8,
      bonus: magic(0, [{ stat: 'targetMaxHp', value: { byRank: [0.015, 0.025, 0.035, 0.045] }, perStat: { stat: 'ap', value: 0.0001 } }]),
    }],
  },
  e: {
    id: 'kogmaw-e', name: 'Void Ooze', maxRank: 4, cooldown: 11, cost: { byRank: [40, 50, 60, 70] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 130, 180, 230] }, [{ stat: 'ap', value: 0.55 }])],
  },
  r: {
    id: 'kogmaw-r', name: 'Living Artillery', maxRank: 3, cooldown: { byRank: [2, 1.5, 1] }, castTime: 0, flags: {},
    // The missing-Health amplification and the doubled damage below 40% Health are not modelled; nor is the
    // stacking Mana cost.
    damage: [magic({ byRank: [80, 120, 160] }, [{ stat: 'ap', value: 0.25 }, { stat: 'bonusAd', value: 0.75 }])],
    effects: [{
      kind: 'stat', id: 'kogmaw-r-corrosion-specialist', name: 'Corrosion Specialist',
      description: 'Gains 10% Attack Speed.', support: 'full',
      stat: 'attackSpeed', amount: { byRank: [0.1, 0.2, 0.3] },
    }],
  },
})

const RELL = modelled('rell', {
  passive: {
    id: 'rell-passive', name: 'Break the Mold', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'onHit', id: 'rell-passive-break-the-mold', name: 'Break the Mold',
      description: 'Attacks deal (5% Armor + 5% Magic Resist) magic damage on hit.',
      support: 'partial', supportNotes: 'The Armor and Magic Resist steal is not modelled.',
      damageType: 'magic', ratios: [{ stat: 'armor', value: 0.05 }, { stat: 'mr', value: 0.05 }],
    }],
  },
  q: {
    id: 'rell-q', name: 'Shattering Strike', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] }, cost: 50, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 130, 190, 250] }, [{ stat: 'ap', value: 0.5 }])],
  },
  w: {
    id: 'rell-w', name: 'Ferromancy: Crash Down', maxRank: 4, cooldown: 9, cost: 40, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 100, 130, 160] }, [{ stat: 'ap', value: 0.5 }])],
  },
  e: {
    ...utility('rell-e', 'Full Tilt', 4, 13, 40),
    effects: [{
      kind: 'empoweredAttack', id: 'rell-e-full-tilt', name: 'Full Tilt',
      description: "Rell's next attack explodes, dealing 5.5% (+0.03% AP) of the target's max Health as magic damage.",
      support: 'partial',
      supportNotes: "How long it waits isn't stated (3 seconds assumed). Empowering Shattering Strike instead is not modelled.",
      grant: { on: 'abilityCast', slots: ['e'], charges: 1 }, maxCharges: 1, durationSeconds: 3,
      bonus: magic(0, [{ stat: 'targetMaxHp', value: { byRank: [0.055, 0.06, 0.065, 0.07] }, perStat: { stat: 'ap', value: 0.0003 } }]),
    }],
  },
  r: {
    id: 'rell-r', name: 'Magnet Storm', maxRank: 3, cooldown: { byRank: [75, 70, 65] }, cost: 100, castTime: 0, flags: {},
    // The 2 seconds of damage at once.
    damage: [magic({ byRank: [120, 200, 280] }, [{ stat: 'ap', value: 1 }])],
  },
})

/** The twentieth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH20: Champion[] = [RIVEN, LILLIA, VELKOZ, KOGMAW, RELL]
