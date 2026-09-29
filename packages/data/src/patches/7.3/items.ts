import type { Item } from '@wr-calc/schema'
import { WRPOCKET_7_3_PROVENANCE } from './provenance'

// Hand-modeled starter items: stats/cost/recipe from wrpocket (English text), plus effects modeled
// with this repo's effect kinds. These replace the generated entries with the same id.
export const STARTER_ITEMS: Item[] = [
  {
    id: 'long-sword', name: 'Long Sword', tier: 'basic',
    cost: { total: 500, combine: 500 }, recipe: [],
    stats: { ad: 12 }, effects: [], tags: ['physical'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'bf-sword', name: 'B. F. Sword', tier: 'epic',
    cost: { total: 1500, combine: 500 }, recipe: ['long-sword', 'long-sword'],
    stats: { ad: 40 }, effects: [], tags: ['physical'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'blasting-wand', name: 'Blasting Wand', tier: 'epic',
    cost: { total: 800, combine: 300 }, recipe: ['amplifying-tome'],
    stats: { ap: 40 }, effects: [], tags: ['magic'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'rabadons-deathcap', name: "Rabadon's Deathcap", tier: 'legendary',
    cost: { total: 3400, combine: 600 }, recipe: ['needlessly-large-rod', 'needlessly-large-rod'],
    stats: { ap: 130 }, tags: ['magic'],
    effects: [{
      kind: 'statMultiplier', id: 'rabadons-deathcap-magic-opus', name: 'Overkill',
      description: 'Increases ability power by 30%.', support: 'full',
      stat: 'ap', layer: 'total', amount: 0.3,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'blade-of-the-ruined-king', name: 'Blade of the Ruined King', tier: 'legendary',
    cost: { total: 3100, combine: 200 }, recipe: ['recurve-bow', 'vampiric-scepter', 'pickaxe'],
    stats: { ad: 40, attackSpeed: 0.3, lifesteal: 0.12 }, tags: ['physical', 'on-hit'],
    effects: [{
      kind: 'onHit', id: 'botrk-mists-edge', name: 'Ruined Strike',
      description: "Basic attacks deal bonus physical damage equal to 7% of the target's current Health "
        + '(8.5% for melee), minimum 15, maximum 100 against monsters.',
      support: 'partial',
      supportNotes: 'Uses the ranged value (7%); melee champions get 8.5%. The Drain slow is not modeled.',
      damageType: 'physical', pctTargetCurrentHp: 0.07, minDamage: 15, monsterCap: 100,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'trinity-force', name: 'Trinity Force', tier: 'legendary',
    cost: { total: 3333, combine: 333 }, recipe: ['sheen', 'hearthbound-axe', 'phage'],
    stats: { ad: 36, hp: 333, attackSpeed: 0.3, abilityHaste: 15 }, tags: ['physical'],
    effects: [{
      kind: 'spellblade', id: 'trinity-force-spellblade', name: 'Spellblade',
      description: 'After using an ability, the next basic attack within 10 seconds deals 200% base '
        + 'Attack Damage as bonus physical damage (1.5 second cooldown).',
      support: 'partial',
      supportNotes: 'Valor move speed is not modeled.',
      damageType: 'physical', bonusDamage: 0,
      ratios: [{ stat: 'ad', layer: 'base', value: 2 }], internalCooldownSeconds: 1.5,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'liandrys-torment', name: "Liandry's Torment", tier: 'legendary',
    cost: { total: 3000, combine: 800 }, recipe: ['haunting-guise', 'fated-ashes'],
    stats: { ap: 70, hp: 300 }, tags: ['magic'],
    effects: [
      {
        kind: 'dot', id: 'liandrys-torment-dot', name: 'Torment',
        description: "Damaging abilities or empowered attacks deal 2% of the target's max Health as "
          + 'bonus magic damage each second, over 3 seconds.',
        support: 'partial',
        // Measured in the 7.3 practice tool (2026-09-26): the burn ticks every 0.5s (6 ticks of ~75
        // against the 100 MR, 10,000 HP dummy), i.e. 1% max HP per tick.
        supportNotes: 'Only abilities apply the burn; empowered attacks are not modeled.',
        damageType: 'magic', tickAmount: 0, targetMaxHpRatio: 0.01, tickIntervalSeconds: 0.5,
        durationSeconds: 3, refresh: 'refresh', ratios: [],
      },
      {
        kind: 'combatRampAmp', id: 'liandrys-torment-madness', name: 'Madness',
        description: 'While fighting enemy champions, deal 2% additional damage each second, up to 6% '
          + 'after 3 seconds.',
        support: 'partial',
        // Measured 2026-09-26: the opening Q wasn't amplified; its burn ticks read 76, 78, 78, 79, 79,
        // 79 (+2%, +4%, +4%, +6%, +6%, +6% on 74.6), and a Q 4s later hit for 567 (+6%).
        supportNotes: 'Combat starts at your first hit and never ends within a combo.',
        amountPerStack: 0.02, stackIntervalSeconds: 1, maxStacks: 3,
      },
    ],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'void-staff', name: 'Void Staff', tier: 'legendary',
    cost: { total: 3000, combine: 600 }, recipe: ['needlessly-large-rod', 'void-amethyst'],
    // Unconditional magic pen is a plain stat, not a `penetration`-kind effect (that kind is
    // reserved for conditional pen — see packages/schema/src/effect/kinds/penetration.ts).
    stats: { ap: 95, pctMagicPen: 0.4 }, effects: [], tags: ['magic'],
    // The shop won't sell Void Staff and Cryptbloom together (in-game, 2026-09-26).
    exclusiveGroup: 'percent-magic-pen',
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'cryptbloom', name: 'Cryptbloom', tier: 'legendary',
    cost: { total: 3000, combine: 600 }, recipe: ['amplifying-tome', 'fiendish-codex', 'void-amethyst'],
    // Life from Death only heals allies after a kill, so it has no 1v1 damage effect to model.
    stats: { ap: 75, pctMagicPen: 0.3, abilityHaste: 20 }, effects: [], tags: ['magic'],
    exclusiveGroup: 'percent-magic-pen',
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'blackfire-torch', name: 'Blackfire Torch', tier: 'legendary',
    cost: { total: 2800, combine: 700 }, recipe: ['lost-chapter', 'fated-ashes'],
    stats: { ap: 80, mana: 500, abilityHaste: 20 }, tags: ['magic'],
    effects: [
      {
        kind: 'dot', id: 'blackfire-torch-baleful-blaze', name: 'Baleful Blaze',
        description: 'Damaging abilities burn enemies, dealing an additional 20 + 2% Ability Power '
          + 'magic damage per second for 3 seconds. Against monsters, they deal 40 + 2% Ability Power '
          + 'magic damage per second.',
        support: 'partial',
        // Measured in the 7.3 practice tool (2026-09-26): the burn ticks every 0.5s, 6 ticks of 12
        // against the 100 MR dummy, so each tick is half the per-second value.
        supportNotes: 'Uses the champion value; the higher damage against monsters is not modeled.',
        damageType: 'magic', tickAmount: 10, ratios: [{ stat: 'ap', value: 0.01 }],
        tickIntervalSeconds: 0.5, durationSeconds: 3, refresh: 'refresh',
      },
      {
        kind: 'statMultiplier', id: 'blackfire-torch-blackfire', name: 'Blackfire',
        description: 'Each enemy champion or monster affected by your Baleful Blaze grants you 4% '
          + 'Ability Power.',
        support: 'full',
        // Measured 2026-09-26: W then Q showed 603 AP (450 x 1.34, adding to Rabadon's 30%) and Q
        // hit for 555. One target only, so at most one 4% stack.
        stat: 'ap', layer: 'total', amount: 0.04,
        condition: { type: 'targetHasDot', effectId: 'blackfire-torch-baleful-blaze' },
      },
    ],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'ludens-echo', name: "Luden's Echo", tier: 'legendary',
    cost: { total: 2800, combine: 500 }, recipe: ['lost-chapter', 'hextech-alternator'],
    stats: { ap: 100, mana: 500, abilityHaste: 10 }, tags: ['magic'],
    effects: [{
      kind: 'abilityHitProc', id: 'ludens-echo-echo', name: 'Echo',
      description: 'Your next damaging ability or empowered basic attack deals 75 + 8% Ability Power '
        + 'magic damage to the primary target and up to 5 nearby enemies. For each fewer target hit '
        + 'by Echo, the primary target takes an additional 20 + 1.2% Ability Power magic damage. '
        + '(9 second cooldown)',
      support: 'partial',
      // Measured in the 7.3 practice tool (2026-09-26): Echo counts "fewer targets" out of 5 total
      // (main target + up to 4 others), not the 5 nearby the text implies; 1, 2 and 3 dummies gave
      // 4, 3 and 2 bonus instances on the main target.
      supportNotes: 'Single target only: modeled as the main target with 4 fewer targets hit '
        + '(75 + 4 × 20 = 155, 8% + 4 × 1.2% = 12.8% AP). Empowered basic attacks do not trigger '
        + 'it. The 9-second cooldown is assumed not to be reduced by ability haste.',
      damageType: 'magic', damage: 155, ratios: [{ stat: 'ap', value: 0.128 }], cooldownSeconds: 9,
      startOnCooldownInputId: 'ludens-echo-on-cooldown',
      inputs: [{
        type: 'boolean', id: 'ludens-echo-on-cooldown',
        label: "Luden's Echo on cooldown at combo start", default: false,
      }],
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'infinity-orb', name: 'Infinity Orb', tier: 'legendary',
    cost: { total: 3100, combine: 600 }, recipe: ['needlessly-large-rod', 'hextech-alternator'],
    stats: { ap: 110, flatMagicPen: 15 }, tags: ['magic'],
    effects: [{
      kind: 'damageAmp', id: 'infinity-orb-inevitable-demise', name: 'Inevitable Demise',
      description: 'Abilities and empowered attacks Critically Strike for 20% bonus damage against '
        + 'enemies below 40% Health.',
      support: 'partial',
      // Measured in the 7.3 practice tool (2026-09-26): Annie's Q, W and R dealt exactly 1.2x below
      // 40% HP, while Luden's Echo on the same Q was not amplified (1090 = 879 Q + 211 Echo).
      supportNotes: 'Empowered basic attacks are not amplified. Luden\'s Echo is correctly excluded '
        + '(verified in game). The 40% threshold is checked against the target\'s HP before each hit.',
      amount: 0.2,
      condition: {
        type: 'allOf',
        conditions: [{ type: 'targetHpBelow', threshold: 0.4 }, { type: 'sourceKind', value: 'ability' }],
      },
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'horizon-focus', name: 'Horizon Focus', tier: 'legendary',
    cost: { total: 2700, combine: 400 }, recipe: ['amplifying-tome', 'fiendish-codex', 'fiendish-codex'],
    stats: { ap: 80, abilityHaste: 25 }, tags: ['magic'],
    effects: [{
      kind: 'damageAmp', id: 'horizon-focus-hypershot', name: 'Hypershot',
      description: 'Damaging an enemy champion with an ability from at least 600 units away reveals '
        + 'them for 8 seconds and increases the damage you deal to them by 10%.',
      support: 'partial',
      // Measured in the 7.3 practice tool (2026-09-26): the dummy counts as a champion, and both the
      // max-range Q that triggers Hypershot and the W/R that follow it dealt 1.1x.
      supportNotes: 'Range is not modeled: the toggle says whether Hypershot is active, and when on it '
        + 'amplifies every hit in the combo, including the one that triggers it. Its 8-second duration '
        + 'and the Focus reveal are not modeled.',
      amount: 0.1,
      condition: { type: 'toggle', inputId: 'horizon-focus-hypershot' },
      inputs: [{
        type: 'boolean', id: 'horizon-focus-hypershot', label: 'Horizon Focus Hypershot active',
        default: false,
      }],
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'malignance', name: 'Malignance', tier: 'legendary',
    cost: { total: 2700, combine: 700 }, recipe: ['blasting-wand', 'lost-chapter'],
    // ultimateHaste 20: "Your ultimate abilities gain 20 Ability Haste" (Scorn).
    stats: { ap: 90, mana: 500, abilityHaste: 15, ultimateHaste: 20 }, tags: ['magic'],
    effects: [{
      kind: 'dot', id: 'malignance-hatefog', name: 'Hatefog',
      description: 'Damaging a champion with your ultimate burns the ground beneath them for 3s, '
        + 'dealing magic damage equal to 60 plus 5% Ability Power per second and reducing their '
        + 'Magic Resist by 10.',
      support: 'partial',
      // Measured in the 7.3 practice tool (2026-09-26): each tick dealt 70 against the 100 MR dummy,
      // so the 10 MR reduction applies to the burn's own ticks (67 without it); Annie's R cooldown
      // showed 44.4s (60 / 1.35), confirming the ultimate haste.
      supportNotes: 'The target is assumed to stay in the burn for all 3 seconds. The burn radius '
        + 'is not modeled.',
      damageType: 'magic', tickAmount: 60, ratios: [{ stat: 'ap', value: 0.05 }],
      tickIntervalSeconds: 1, durationSeconds: 3, refresh: 'refresh',
      condition: { type: 'abilitySlot', value: 'r' },
      shredWhileActive: { resist: 'mr', amount: 10 },
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'stormsurge', name: 'Stormsurge', tier: 'legendary',
    cost: { total: 2800, combine: 750 }, recipe: ['aether-wisp', 'hextech-alternator'],
    stats: { ap: 90, moveSpeedPct: 0.06, flatMagicPen: 15 }, tags: ['magic'],
    effects: [{
      kind: 'damageWindowProc', id: 'stormsurge-squall', name: 'Stormraider / Squall',
      description: "When you deal damage equal to 25% of a champion's max Health within 2.5 seconds, "
        + 'inflict Squall on them and gain 25% Movement Speed for 2.5 seconds (25-second cooldown). '
        + 'Squall: after 2 seconds, deal 125 + 10% Ability Power magic damage.',
      support: 'partial',
      // Not verifiable in the 7.3 practice tool (2026-09-26): Squall never triggered on the
      // dummy, even with a 6-item build dealing over 2,500 in 2.5s, so the dummy seems not to count
      // as a champion for Stormsurge (unlike Horizon Focus and Malignance, which did trigger).
      supportNotes: 'Unverified in game. Counts damage after resists. The movement speed and the '
        + '"target dies first" splash are not modeled.',
      targetMaxHpFraction: 0.25, windowSeconds: 2.5, delaySeconds: 2, damageType: 'magic',
      damage: 125, ratios: [{ stat: 'ap', value: 0.1 }], cooldownSeconds: 25,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'lich-bane', name: 'Lich Bane', tier: 'legendary',
    cost: { total: 2800, combine: 550 }, recipe: ['amplifying-tome', 'aether-wisp', 'sheen'],
    stats: { ap: 100, moveSpeedPct: 0.05, abilityHaste: 10 }, tags: ['magic'],
    effects: [{
      kind: 'spellblade', id: 'lich-bane-spellblade', name: 'Spellblade',
      description: 'After using an ability, the next basic attack within 10 seconds deals 75% base '
        + 'Attack Damage + 45% Ability Power as bonus magic damage (1.5 second cooldown).',
      // Measured in the 7.3 practice tool (2026-09-26): Q then a basic attack showed the attack (45
      // physical) and the proc (256 magic) as separate numbers, matching 341.7 raw at 89 AD, 611 AP.
      support: 'full',
      damageType: 'magic', bonusDamage: 0,
      ratios: [{ stat: 'ad', layer: 'base', value: 0.75 }, { stat: 'ap', value: 0.45 }],
      internalCooldownSeconds: 1.5,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'riftmaker', name: 'Riftmaker', tier: 'legendary',
    cost: { total: 3100, combine: 900 }, recipe: ['fiendish-codex', 'haunting-guise'],
    stats: { ap: 70, hp: 350, abilityHaste: 15 }, tags: ['magic'],
    effects: [
      {
        kind: 'statConversion', id: 'riftmaker-void-infusion', name: 'Void Infusion',
        description: 'Gain Ability Power equal to 2% of your bonus Health.',
        // Measured 2026-09-26: 582 AP with 350 bonus HP = (440 + 7) x 1.3, so Rabadon's
        // multiplies the converted AP.
        support: 'full',
        fromStat: 'hp', fromLayer: 'bonus', toStat: 'ap', ratio: 0.02,
      },
      {
        kind: 'combatRampAmp', id: 'riftmaker-void-corruption', name: 'Void Corruption',
        description: 'While in combat with champions, deal 2% additional damage each second, up to 8%.',
        support: 'partial',
        // Measured 2026-09-26: a Q 4-5s into combat hit for 584 (540.4 x 1.08). The per-second
        // timing is assumed to match Liandry's Madness, which was measured tick by tick.
        supportNotes: 'Combat starts at your first hit and never ends within a combo. Omnivamp is not '
          + 'modeled.',
        amountPerStack: 0.02, stackIntervalSeconds: 1, maxStacks: 4,
      },
    ],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'black-cleaver', name: 'Black Cleaver', tier: 'legendary',
    cost: { total: 3000, combine: 500 }, recipe: ['long-sword', 'phage', 'kindlegem'],
    stats: { ad: 40, hp: 400, abilityHaste: 20 }, tags: ['physical'],
    effects: [{
      kind: 'resistShred', id: 'black-cleaver-carve', name: 'Sunder',
      description: "Dealing physical damage to a champion reduces their Armor by 6% for 6 seconds, "
        + 'stacking up to 5 times (30%).',
      support: 'partial',
      supportNotes: '"To a champion" isn\'t enforced (it also stacks on monster hits), and Rage '
        + 'move speed is not modeled.',
      condition: { type: 'damageType', value: 'physical' },
      resist: 'armor', mode: 'percent', amount: 0.06, stacking: true, maxStacks: 5,
      durationSeconds: 6,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'infinity-edge', name: 'Infinity Edge', tier: 'legendary',
    cost: { total: 3400, combine: 600 }, recipe: ['brawlers-gloves', 'bf-sword', 'pickaxe'],
    // critDamage 0.3: "Critical strike damage increased from 200% to 230%."
    stats: { ad: 75, critChance: 0.25, critDamage: 0.3 }, effects: [], tags: ['physical', 'crit'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'navori-quickblades', name: 'Navori Quickblades', tier: 'legendary',
    cost: { total: 2650, combine: 450 }, recipe: ['dagger', 'dagger', 'zeal'],
    stats: { attackSpeed: 0.4, critChance: 0.25, moveSpeedPct: 0.04 }, tags: ['physical', 'crit'],
    effects: [{
      kind: 'cooldownRefund', id: 'navori-untold-determination', name: 'Deft Strikes',
      description: 'Attacks reduce the remaining cooldowns of your basic abilities by 15%.',
      support: 'partial',
      supportNotes: 'The real passive triggers on basic attacks; the cooldownRefund kind only triggers '
        + 'on ability hits.',
      mode: 'percent', amount: 0.15, excludesUltimate: true,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'heartsteel', name: 'Heartsteel', tier: 'legendary',
    cost: { total: 2800, combine: 300 }, recipe: ['ruby-crystal', 'kindlegem', 'giants-belt'],
    // wrpocket also lists healthRegen 150 (% of base regen), which has no flat-stat equivalent here.
    stats: { hp: 700, abilityHaste: 20 }, tags: ['tank', 'on-hit'],
    effects: [
      {
        kind: 'stacking', id: 'heartsteel-vigor', name: 'Colossal Consumption (bonus Health gained)',
        description: "Charged strikes grant maximum Health equal to 15% of the damage dealt.",
        support: 'partial',
        supportNotes: 'The Health already gained is a manual input (1 stack = 1 Health); it is not '
          + 'accumulated from strikes automatically.',
        stat: 'hp', perStack: 1, maxStacks: 3000, stackInputId: 'heartsteel-stacks',
        inputs: [{
          type: 'stackCount', id: 'heartsteel-stacks', label: 'Heartsteel bonus Health gained',
          min: 0, max: 3000, default: 0,
        }],
      },
      {
        kind: 'onHit', id: 'heartsteel-repurpose', name: 'Colossal Consumption (charged strike)',
        description: 'A charged attack deals bonus physical damage equal to 140 + 3.5% of maximum Health.',
        support: 'partial',
        supportNotes: 'Applies to every basic attack while the toggle is on; in-game it charges for 2.5 '
          + 'seconds near an enemy champion and has a 20-second cooldown per target.',
        damageType: 'physical', flat: 140, pctOwnStat: { stat: 'hp', ratio: 0.035 },
        condition: { type: 'toggle', inputId: 'heartsteel-charge-ready' },
        inputs: [{
          type: 'boolean', id: 'heartsteel-charge-ready', label: 'Heartsteel charged strike ready',
          default: false,
        }],
      },
    ],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'seraphs-embrace', name: "Seraph's Embrace", tier: 'legendary',
    // Not on wrpocket: it's Archangel's Staff after Mana Charge reaches 700 bonus Mana. Stats are
    // Archangel's (60 AP, 500 Mana, 25 AH) plus that 700 Mana; no extra gold to "buy" it.
    cost: { total: 3000, combine: 0 }, recipe: ['archangels-staff'],
    stats: { ap: 60, mana: 1200, abilityHaste: 25 }, tags: ['magic'],
    effects: [
      {
        kind: 'statConversion', id: 'seraphs-embrace-focused-will', name: 'Awe',
        description: 'Gain Ability Power equal to 1% of your maximum Mana.',
        support: 'full',
        fromStat: 'mana', toStat: 'ap', ratio: 0.01,
      },
      {
        kind: 'shield', id: 'seraphs-embrace-bottomless-well', name: 'Lifeline',
        description: "Seraph's upgraded shield. Values aren't on wrpocket; verify in-game.",
        support: 'partial',
        supportNotes: 'Modeled as a manually toggled shield; trigger and cooldown are not modeled.',
        amount: null, durationSeconds: null,
        condition: { type: 'toggle', inputId: 'seraphs-embrace-shield-used' },
        inputs: [{
          type: 'boolean', id: 'seraphs-embrace-shield-used',
          label: "Seraph's Embrace shield used", default: false,
        }],
      },
    ],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'plated-steelcaps', name: 'Plated Steelcaps', tier: 'boots',
    cost: { total: 1200, combine: 300 }, recipe: ['ruby-crystal', 'boots-of-speed'],
    stats: { hp: 150, armor: 25, moveSpeed: 45 }, tags: ['boots', 'defense'],
    effects: [{
      kind: 'damageReduction', id: 'plated-steelcaps-reinforced-armor', name: 'Block',
      description: 'Reduces damage taken from champion basic attacks by 10%.',
      support: 'partial',
      supportNotes: 'Modeled as reducing all physical damage; the real passive only reduces '
        + 'basic-attack damage specifically.',
      damageType: 'physical', amount: 0.1,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'force-of-nature', name: 'Force of Nature', tier: 'legendary',
    cost: { total: 2800, combine: 500 }, recipe: ['ruby-crystal', 'negatron-cloak', 'winged-moonplate'],
    stats: { hp: 400, mr: 60, moveSpeedPct: 0.04 }, tags: ['magic-resist'],
    effects: [
      {
        kind: 'stacking', id: 'force-of-nature-steadfast-mr', name: 'Steadfast (Magic Resist)',
        description: 'Taking magic damage from enemy champions grants a stack of Steadfast, up to '
          + '4, for 7 seconds. At max stacks, gain 70 bonus Magic Resist.',
        support: 'partial',
        supportNotes: 'The stack count is a manual toggle (0 or max) here, not accumulated from '
          + 'taking magic damage; also declares the shared "at max stacks" input.',
        stat: 'mr', perStack: 70, maxStacks: 1, stackInputId: 'force-of-nature-max-stacks',
        inputs: [{
          type: 'stackCount', id: 'force-of-nature-max-stacks', label: 'Force of Nature at max stacks',
          min: 0, max: 1, default: 0,
        }],
      },
      {
        kind: 'stacking', id: 'force-of-nature-steadfast-ms', name: 'Steadfast (Move Speed)',
        description: 'Taking magic damage from enemy champions grants a stack of Steadfast, up to '
          + '4, for 7 seconds. At max stacks, gain 6% Move Speed.',
        support: 'partial',
        supportNotes: 'Shares the "Force of Nature at max stacks" input declared by '
          + 'force-of-nature-steadfast-mr; the stack count is a manual toggle (0 or max) here, not '
          + 'accumulated from taking magic damage.',
        stat: 'moveSpeedPct', perStack: 0.06, maxStacks: 1, stackInputId: 'force-of-nature-max-stacks',
      },
    ],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
]
