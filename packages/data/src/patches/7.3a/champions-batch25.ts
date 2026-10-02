import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 25 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Sion (Baron), Amumu (Jungle), Vex (Mid) and Ornn (Support); every Dragon-lane pick is already modelled. Same
// approach as the earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing
// checked in game yet.

const SION = modelled('sion', {
  // Glory in Death (Health per kill, the reanimation) is not modelled.
  passive: utility('sion-passive', 'Glory in Death', 1, null),
  q: {
    id: 'sion-q', name: 'Decimating Smash', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: 45, castTime: 0, flags: {},
    // Fully charged; the 1.75 second charge itself is not modelled.
    damage: [physical({ byRank: [100, 185, 270, 355] }, [{ stat: 'totalAd', value: { byRank: [1.35, 1.65, 1.95, 2.25] } }])],
  },
  w: {
    id: 'sion-w', name: 'Soul Furnace', maxRank: 4, cooldown: { byRank: [14, 13, 12, 11] }, cost: { byRank: [65, 70, 75, 80] },
    castTime: 0, flags: {},
    // The detonation, at once (the 2 second wait is not modelled).
    damage: [magic({ byRank: [60, 90, 120, 150] }, [
      { stat: 'ap', value: 0.4 }, { stat: 'targetMaxHp', value: { byRank: [0.1, 0.11, 0.12, 0.13] } },
    ])],
  },
  e: {
    id: 'sion-e', name: 'Roar of the Slayer', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] }, cost: { byRank: [35, 40, 45, 50] },
    castTime: 0, flags: {},
    // The 20% Armor reduction is not modelled.
    damage: [magic({ byRank: [75, 120, 165, 210] }, [{ stat: 'ap', value: 0.55 }])],
  },
  r: {
    id: 'sion-r', name: 'Unstoppable Onslaught', maxRank: 3, cooldown: { byRank: [90, 70, 50] }, cost: 100, castTime: 0, flags: {},
    // Fully charged.
    damage: [physical({ byRank: [400, 800, 1200] }, [{ stat: 'bonusAd', value: 0.8 }])],
  },
})

const AMUMU = modelled('amumu', {
  // Cursed Touch (10% of magic damage taken as extra true damage) is not modelled.
  passive: utility('amumu-passive', 'Cursed Touch', 1, null),
  q: {
    id: 'amumu-q', name: 'Bandage Toss', maxRank: 4, cooldown: 3, cost: { byRank: [35, 40, 45, 50] }, castTime: 0, flags: {},
    // One bandage; the 2 charges are not modelled.
    damage: [magic({ byRank: [60, 95, 130, 165] }, [{ stat: 'ap', value: 0.7 }])],
  },
  w: {
    ...utility('amumu-w', 'Despair', 4, 1, { byRank: [10, 11, 12, 13] }),
    effects: [{
      kind: 'dot', id: 'amumu-w-despair', name: 'Despair',
      description: 'Deals 25 magic damage + 1.2% (+0.4% AP) of the target\'s max Health every second.',
      support: 'partial',
      supportNotes: 'Toggled on for 5 seconds per cast (it lasts until turned off in game). The +0.4% per AP is not modelled.',
      damageType: 'magic', tickAmount: { byRank: [25, 30, 35, 40] }, targetMaxHpRatio: { byRank: [0.012, 0.015, 0.018, 0.021] },
      tickIntervalSeconds: 1, durationSeconds: 5, refresh: 'refresh', appliedBy: ['w'], ratios: [],
    }],
  },
  e: {
    id: 'amumu-e', name: 'Tantrum', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: 35, castTime: 0, flags: {},
    damage: [magic({ byRank: [90, 120, 150, 180] }, [{ stat: 'ap', value: 0.5 }])],
  },
  r: {
    id: 'amumu-r', name: 'Curse of the Sad Mummy', maxRank: 3, cooldown: { byRank: [105, 95, 85] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.7 }])],
  },
})

const VEX = modelled('vex', {
  // Doom 'n Gloom (the fear and the Gloom bonus damage after an enemy dashes) is not modelled.
  passive: utility('vex-passive', "Doom 'n Gloom", 1, null),
  q: {
    id: 'vex-q', name: 'Mistral Bolt', maxRank: 4, cooldown: { byRank: [7, 6, 5, 4] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 120, 180, 240] }, [{ stat: 'ap', value: 0.65 }])],
  },
  w: {
    id: 'vex-w', name: 'Personal Space', maxRank: 4, cooldown: { byRank: [18, 16, 14, 12] }, cost: 75, castTime: 0, flags: {},
    damage: [magic({ byRank: [65, 120, 175, 230] }, [{ stat: 'ap', value: 0.3 }])],
  },
  e: {
    id: 'vex-e', name: 'Looming Darkness', maxRank: 4, cooldown: 13, cost: { byRank: [80, 90, 100, 110] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [50, 80, 110, 140] }, [{ stat: 'ap', value: { byRank: [0.4, 0.45, 0.5, 0.55] } }])],
  },
  r: {
    id: 'vex-r', name: 'Shadow Surge', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // The bolt and the recast dash, both at once.
    damage: [
      magic({ byRank: [75, 125, 175] }, [{ stat: 'ap', value: 0.2 }]),
      magic({ byRank: [150, 250, 350] }, [{ stat: 'ap', value: 0.5 }]),
    ],
  },
})

const ORNN = modelled('ornn', {
  passive: {
    id: 'ornn-passive', name: 'Living Forge', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: (['hp', 'armor', 'mr'] as const).map((stat) => ({
      kind: 'statMultiplier' as const, id: `ornn-passive-bonus-${stat}`, name: `Living Forge (${stat})`,
      description: 'Gains an additional 7% bonus max Health, Armor and Magic Resist from all sources.',
      support: 'partial' as const, supportNotes: '7% at every level (the level scaling is not stated).',
      stat, layer: 'bonus' as const, amount: 0.07,
    })),
  },
  q: {
    id: 'ornn-q', name: 'Volcanic Rupture', maxRank: 4, cooldown: { byRank: [9, 8.5, 8, 7.5] }, cost: 45, castTime: 0, flags: {},
    damage: [physical({ byRank: [25, 60, 95, 130] }, [{ stat: 'totalAd', value: 1.1 }])],
  },
  w: {
    id: 'ornn-w', name: 'Bellows Breath', maxRank: 4, cooldown: { byRank: [11.5, 11, 10.5, 10] }, cost: { byRank: [45, 50, 55, 60] },
    castTime: 0, flags: {},
    // The 0.75 seconds of fire at once. Brittle's bonus damage on immobilizing effects is not modelled.
    damage: [magic(0, [{ stat: 'targetMaxHp', value: { byRank: [0.1, 0.11, 0.12, 0.13] } }])],
  },
  e: {
    id: 'ornn-e', name: 'Searing Charge', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, cost: { byRank: [35, 40, 45, 50] },
    castTime: 0, flags: {},
    damage: [physical({ byRank: [80, 140, 200, 260] }, [{ stat: 'bonusArmor', value: 0.4 }, { stat: 'bonusMr', value: 0.4 }])],
  },
  r: {
    id: 'ornn-r', name: 'Call of the Forge God', maxRank: 3, cooldown: { byRank: [90, 80, 70] }, cost: 100, castTime: 0, flags: {},
    // The elemental and its redirected charge both hit the target.
    damage: [{ ...magic({ byRank: [125, 175, 225] }, [{ stat: 'ap', value: 0.2 }]), hits: 2 }],
  },
})

/** The twenty-fifth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH25: Champion[] = [SION, AMUMU, VEX, ORNN]
