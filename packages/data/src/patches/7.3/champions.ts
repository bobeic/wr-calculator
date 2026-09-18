import type { Champion } from '@wr-calc/schema'
import { PATCH_7_3_PROVENANCE } from './provenance'

export const PATCH_7_3_CHAMPIONS: Champion[] = [
  {
    id: 'nunu-willump', name: 'Nunu & Willump', resource: 'mana',
    baseStats: {
      hp: { base: 610, perLevel: 90 }, hpRegen: { base: 8, perLevel: 0.8 },
      mana: { base: 280, perLevel: 40 }, manaRegen: { base: 7, perLevel: 0.6 },
      ad: { base: 60, perLevel: 3 }, armor: { base: 32, perLevel: 4 },
      mr: { base: 30, perLevel: 1.3 }, moveSpeed: { base: 345, perLevel: 0 },
    },
    attackSpeed: { base: 0.625, ratio: 0.025 },
    abilities: {
      passive: {
        id: 'nunu-passive', name: 'Call of the Freljord', maxRank: 1,
        cooldown: null, castTime: 0, damage: [], flags: {},
      },
      q: {
        id: 'nunu-q', name: 'Consume', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.5, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], hits: 1, tags: ['consume'] }],
      },
      w: {
        id: 'nunu-w', name: 'Biggest Snowball Ever!', maxRank: 5,
        cooldown: null, cost: null, castTime: 0, damage: [], flags: {},
      },
      e: {
        id: 'nunu-e', name: 'Snowball Barrage', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], hits: 3, tags: [] }],
      },
      r: {
        id: 'nunu-r', name: 'Absolute Zero', maxRank: 3,
        cooldown: null, cost: null, castTime: 3, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: ['channel'] }],
      },
    },
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'rammus', name: 'Rammus', resource: 'mana',
    baseStats: {
      hp: { base: 600, perLevel: 95 }, hpRegen: { base: 9, perLevel: 0.9 },
      mana: { base: 250, perLevel: 35 }, manaRegen: { base: 7, perLevel: 0.6 },
      ad: { base: 68, perLevel: 3.5 }, armor: { base: 36, perLevel: 4.2 },
      mr: { base: 32, perLevel: 1.3 }, moveSpeed: { base: 335, perLevel: 0 },
    },
    attackSpeed: { base: 0.65, ratio: 0.03 },
    abilities: {
      passive: {
        id: 'rammus-passive', name: 'Spiked Shell', maxRank: 1,
        cooldown: null, castTime: 0, damage: [], flags: { appliesOnHit: true },
      },
      q: {
        id: 'rammus-q', name: 'Powerball', maxRank: 5,
        cooldown: null, cost: null, castTime: 0, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: ['impact'] }],
      },
      w: {
        id: 'rammus-w', name: 'Defensive Ball Curl', maxRank: 5,
        cooldown: null, cost: null, castTime: 0, damage: [], flags: { appliesOnHit: true },
      },
      e: {
        id: 'rammus-e', name: 'Frenzying Taunt', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, damage: [], flags: {},
      },
      r: {
        id: 'rammus-r', name: 'Soaring Slam', maxRank: 3,
        cooldown: null, cost: null, castTime: 0.5, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: [] }],
      },
    },
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'annie', name: 'Annie', resource: 'mana',
    baseStats: {
      hp: { base: 560, perLevel: 90 }, hpRegen: { base: 6, perLevel: 0.6 },
      mana: { base: 450, perLevel: 35 }, manaRegen: { base: 8, perLevel: 0.7 },
      ad: { base: 50, perLevel: 3 }, armor: { base: 20, perLevel: 3.8 },
      mr: { base: 30, perLevel: 1.3 }, moveSpeed: { base: 325, perLevel: 0 },
    },
    attackSpeed: { base: 0.625, ratio: 0.02 },
    abilities: {
      passive: {
        id: 'annie-passive', name: 'Pyromania', maxRank: 1,
        cooldown: null, castTime: 0, damage: [], flags: {},
      },
      q: {
        id: 'annie-q', name: 'Disintegrate', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: [] }],
      },
      w: {
        id: 'annie-w', name: 'Incinerate', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: ['aoe'] }],
      },
      e: {
        id: 'annie-e', name: 'Molten Shield', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, damage: [], flags: {},
      },
      r: {
        id: 'annie-r', name: 'Summon: Tibbers', maxRank: 3,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: ['summon-initial'] }],
      },
    },
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'jinx', name: 'Jinx', resource: 'mana',
    baseStats: {
      hp: { base: 580, perLevel: 100 }, hpRegen: { base: 5.5, perLevel: 0.55 },
      mana: { base: 260, perLevel: 45 }, manaRegen: { base: 6, perLevel: 0.6 },
      ad: { base: 57, perLevel: 3.4 }, armor: { base: 26, perLevel: 4.7 },
      mr: { base: 30, perLevel: 1.3 }, moveSpeed: { base: 325, perLevel: 0 },
    },
    attackSpeed: { base: 0.625, ratio: 0.03 },
    abilities: {
      passive: {
        id: 'jinx-passive', name: 'Get Excited!', maxRank: 1,
        cooldown: null, castTime: 0, damage: [], flags: {},
      },
      q: {
        id: 'jinx-q', name: 'Switcheroo!', maxRank: 5,
        cooldown: null, cost: null, castTime: 0, damage: [], flags: {},
      },
      w: {
        id: 'jinx-w', name: 'Zap!', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'physical', base: null, ratios: [{ stat: 'totalAd', value: null }], tags: [] }],
      },
      e: {
        id: 'jinx-e', name: 'Flame Chompers!', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'physical', base: null, ratios: [{ stat: 'bonusAd', value: null }], tags: ['trap'] }],
      },
      r: {
        id: 'jinx-r', name: 'Super Mega Death Rocket!', maxRank: 3,
        cooldown: null, cost: null, castTime: 0.5, flags: {},
        damage: [{ type: 'physical', base: null, ratios: [{ stat: 'bonusAd', value: null }], tags: ['execute'] }],
      },
    },
    provenance: PATCH_7_3_PROVENANCE,
  },
]
