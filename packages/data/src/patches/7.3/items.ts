import type { Item } from '@wr-calc/schema'
import { PATCH_7_3_PROVENANCE } from './provenance'

export const PATCH_7_3_ITEMS: Item[] = [
  {
    id: 'long-sword', name: 'Long Sword', tier: 'basic',
    cost: { total: 350, combine: 350 }, recipe: [],
    stats: { ad: null }, effects: [], tags: ['physical'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'bf-sword', name: 'B.F. Sword', tier: 'basic',
    cost: { total: 1300, combine: 1300 }, recipe: [],
    stats: { ad: null }, effects: [], tags: ['physical'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'blasting-wand', name: 'Blasting Wand', tier: 'basic',
    cost: { total: 850, combine: 850 }, recipe: [],
    stats: { ap: null }, effects: [], tags: ['magic'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'rabadons-deathcap', name: "Rabadon's Deathcap", tier: 'legendary',
    cost: { total: 2950, combine: 2950 }, recipe: [],
    stats: { ap: null }, tags: ['magic'],
    effects: [{
      kind: 'statMultiplier', id: 'rabadons-deathcap-magic-opus', name: 'Magic Opus',
      description: 'Increases total ability power.', support: 'full',
      stat: 'ap', layer: 'total', amount: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'blade-of-the-ruined-king', name: 'Blade of the Ruined King', tier: 'legendary',
    cost: { total: 3200, combine: 3200 }, recipe: [],
    stats: { ad: null, attackSpeed: null, lifesteal: null }, tags: ['physical', 'on-hit'],
    effects: [{
      kind: 'onHit', id: 'botrk-mists-edge', name: "Mist's Edge",
      description: 'On-hit: deals physical damage equal to a percent of the target\'s current HP.',
      support: 'full',
      damageType: 'physical', pctTargetCurrentHp: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'trinity-force', name: 'Trinity Force', tier: 'legendary',
    cost: { total: 3333, combine: 3333 }, recipe: [],
    stats: { ad: null, attackSpeed: null, abilityHaste: null, hp: null }, tags: ['physical'],
    effects: [{
      kind: 'spellblade', id: 'trinity-force-spellblade', name: 'Spellblade',
      description: 'After using an ability, the next basic attack deals bonus physical damage.',
      support: 'full',
      damageType: 'physical', bonusDamage: null,
      ratios: [{ stat: 'ad', value: null }], internalCooldownSeconds: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'liandrys-torment', name: "Liandry's Torment", tier: 'legendary',
    cost: { total: 2900, combine: 2900 }, recipe: [],
    stats: { ap: null, hp: null, abilityHaste: null }, tags: ['magic'],
    effects: [{
      kind: 'dot', id: 'liandrys-torment-dot', name: 'Torment',
      description: 'Ability damage burns the target over time.',
      support: 'partial',
      supportNotes: 'Modeled as a flat/AP-ratio DoT only; the real %-max-health burn component '
        + 'and multi-target stacking are not modeled.',
      damageType: 'magic', tickAmount: null, tickIntervalSeconds: 1, durationSeconds: null,
      refresh: 'refresh',
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'void-staff', name: 'Void Staff', tier: 'legendary',
    cost: { total: 2650, combine: 2650 }, recipe: [],
    // Unconditional magic pen is a plain stat, not a `penetration`-kind effect (that kind is
    // reserved for conditional pen — see packages/schema/src/effect/kinds/penetration.ts).
    stats: { ap: null, pctMagicPen: null }, effects: [], tags: ['magic'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'black-cleaver', name: 'Black Cleaver', tier: 'legendary',
    cost: { total: 3000, combine: 3000 }, recipe: [],
    stats: { ad: null, hp: null, abilityHaste: null }, tags: ['physical'],
    effects: [{
      kind: 'resistShred', id: 'black-cleaver-carve', name: 'Carve',
      description: 'On-hit: reduces the target\'s armor for a few seconds, stacking.',
      support: 'full',
      resist: 'armor', mode: 'percent', amount: null, stacking: true, maxStacks: 6,
      durationSeconds: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'infinity-edge', name: 'Infinity Edge', tier: 'legendary',
    cost: { total: 3400, combine: 3400 }, recipe: [],
    stats: { ad: null, critChance: null, critDamage: null }, effects: [], tags: ['physical', 'crit'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'navori-quickblades', name: 'Navori Quickblades', tier: 'legendary',
    cost: { total: 3400, combine: 3400 }, recipe: [],
    stats: { ad: null, critChance: null, attackSpeed: null }, tags: ['physical', 'crit'],
    effects: [{
      kind: 'cooldownRefund', id: 'navori-untold-determination', name: 'Untold Determination',
      description: 'Critical strikes refund a percent of ability cooldowns, including the ultimate.',
      support: 'full',
      mode: 'percent', amount: null, excludesUltimate: false,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'heartsteel', name: 'Heartsteel', tier: 'legendary',
    cost: { total: 3000, combine: 3000 }, recipe: [],
    stats: { hp: null }, tags: ['tank', 'on-hit'],
    effects: [
      {
        kind: 'stacking', id: 'heartsteel-vigor', name: 'Vigor',
        description: 'Gains stacking bonus health from takedowns and objectives.',
        support: 'partial',
        supportNotes: 'Stack count is a manual input here, not auto-accumulated from '
          + 'takedowns/objectives as in-game.',
        stat: 'hp', perStack: null, maxStacks: 20, stackInputId: 'heartsteel-stacks',
        inputs: [{
          type: 'stackCount', id: 'heartsteel-stacks', label: 'Heartsteel stacks',
          min: 0, max: 20, default: 0,
        }],
      },
      {
        kind: 'onHit', id: 'heartsteel-repurpose', name: 'Repurpose',
        description: 'On-hit: deals bonus physical damage scaling with bonus health.',
        support: 'full',
        damageType: 'physical', pctOwnStat: { stat: 'hp', ratio: null },
      },
    ],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'seraphs-embrace', name: "Seraph's Embrace", tier: 'legendary',
    cost: { total: 3000, combine: 3000 }, recipe: [],
    stats: { ap: null, mana: null }, tags: ['magic'],
    effects: [
      {
        kind: 'statConversion', id: 'seraphs-embrace-focused-will', name: 'Focused Will',
        description: 'Grants ability power equal to a percent of maximum mana.',
        support: 'full',
        fromStat: 'mana', toStat: 'ap', ratio: null,
      },
      {
        kind: 'shield', id: 'seraphs-embrace-bottomless-well', name: 'Bottomless Well',
        description: 'Active: grants a shield scaling with maximum mana.',
        support: 'partial',
        supportNotes: 'Modeled as a manually toggled shield; the real active\'s cast time and '
          + 'cooldown interaction are not modeled.',
        amount: null, durationSeconds: null,
        condition: { type: 'toggle', inputId: 'seraphs-embrace-shield-used' },
        inputs: [{
          type: 'boolean', id: 'seraphs-embrace-shield-used',
          label: "Seraph's Embrace shield used", default: false,
        }],
      },
    ],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'plated-steelcaps', name: 'Plated Steelcaps', tier: 'boots',
    cost: { total: 1100, combine: 1100 }, recipe: [],
    stats: { armor: null, moveSpeed: null }, tags: ['boots', 'defense'],
    effects: [{
      kind: 'damageReduction', id: 'plated-steelcaps-reinforced-armor', name: 'Reinforced Armor',
      description: 'Reduces incoming damage from basic attacks.',
      support: 'partial',
      supportNotes: 'Modeled as reducing all physical damage; the real passive only reduces '
        + 'basic-attack damage specifically.',
      damageType: 'physical', amount: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'force-of-nature', name: 'Force of Nature', tier: 'legendary',
    cost: { total: 2800, combine: 2800 }, recipe: [],
    stats: { mr: null, moveSpeedPct: null, hpRegen: null }, effects: [],
    tags: ['magic-resist'],
    provenance: PATCH_7_3_PROVENANCE,
  },
]
