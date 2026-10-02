import type { Effect, Item } from '@wr-calc/schema'
import { GENERATED_ITEMS } from './generated/items'
import { WRPOCKET_7_3A_PROVENANCE } from './provenance'

// Batch 6 (2026-10-02): every remaining item passive that changes a 1v1 damage calculation. Numbers come from
// wrpocket's 7.3a text (trusted by default, see ADR 2026-10-01-data-source-priority.md); price, recipe and stats
// are synced from the generated entry, so only effects and stats wrpocket doesn't list are written here.
// Passives that only protect the holder, move them, or need allies (spell shields, revives, grievous wounds,
// movement speed, slows, shield reduction) are left out; docs/decisions/2026-10-02-item-batch6.md lists them.
// Nothing here has been checked in game yet.

function modelled(id: string, effects: Effect[], extraStats: Item['stats'] = {}): Item {
  const generated = GENERATED_ITEMS.find((item) => item.id === id)
  if (generated === undefined) throw new Error(`batch 6: no generated 7.3a item ${id}`)
  return { ...generated, stats: { ...generated.stats, ...extraStats }, effects, provenance: WRPOCKET_7_3A_PROVENANCE }
}

const toggle = (id: string, label: string, defaultOn = false) => [{ type: 'boolean' as const, id, label, default: defaultOn }]
const stacks = (id: string, label: string, max: number) => [{ type: 'stackCount' as const, id, label, min: 0, max, default: 0 }]

// Energized attacks charge from movement and attacks: confirmed in game (2026-10-02) at 9 energy per attack, 100
// needed for an Energized attack. Statikk Shiv's "5 additional Energized stacks" on top of the normal 9 means 14
// per attack. Movement also charges it but isn't modelled, so standing-still attack counts (ceil(100/9) = 12,
// ceil(100/14) = 8) overcount how long it takes while kiting. The start-ready input covers walking in charged.
const ENERGIZED_ATTACKS = 12
const STATIKK_ENERGIZED_ATTACKS = 8
const ENERGIZED_READY = 'energized-ready'
const energizedInput = toggle(ENERGIZED_READY, 'Energized attack charged at combo start', true)

// "While in combat": confirmed in game (2026-10-02) that these tick for as long as the target stays in range and
// you're in combat, stopping immediately once the target leaves range — but how long "in combat" itself lasts after
// your last hit (with no range check to fall back on) still isn't stated. 3 seconds is assumed where the text gives
// nothing; Hollow Radiance states 5.
const COMBAT_WINDOW_SECONDS = 3

const SEETHING_STRIKE_ID = 'guinsoos-rageblade-seething-strike'

export const BATCH6_ITEMS: Item[] = [
  // --- Components ---
  modelled('recurve-bow', [{
    kind: 'onHit', id: 'recurve-bow-reinforced', name: 'Reinforced',
    description: 'Attacks deal 15 bonus physical damage on-hit.', support: 'full',
    damageType: 'physical', flat: 15,
  }]),
  modelled('sheen', [{
    kind: 'spellblade', id: 'sheen-spellblade', name: 'Spellblade',
    description: 'Using an ability causes the next attack used within 10 seconds to deal bonus physical damage '
      + 'equal to 100% base Attack Damage. (1.5 second Cooldown)',
    support: 'partial', supportNotes: 'Reduced damage against structures is not modelled.',
    damageType: 'physical', bonusDamage: 0, ratios: [{ stat: 'ad', layer: 'base', value: 1 }],
    internalCooldownSeconds: 1.5,
  }]),
  modelled('kircheis-shard', [{
    kind: 'abilityHitProc', id: 'kircheis-shard-shock', name: 'Shock',
    description: 'Damaging an enemy champion adds 40 magic damage. (25 second Cooldown. Each basic attack reduces '
      + 'the remaining cooldown by 1 second.)',
    support: 'partial', supportNotes: 'Basic attacks don\'t shorten the cooldown here.',
    damageType: 'magic', damage: 40, ratios: [], cooldownSeconds: 25, triggeredBy: ['ability', 'basicAttack'],
  }]),
  modelled('hextech-alternator', [{
    kind: 'abilityHitProc', id: 'hextech-alternator-revved', name: 'Revved',
    description: 'Damaging abilities and empowered attacks against champions deal 25–60 bonus magic damage '
      + '(20 second Cooldown).',
    support: 'partial', supportNotes: '25–60 is taken as linear over levels 1–15.',
    damageType: 'magic', damage: { levelRange: { min: 25, max: 60 } }, ratios: [], cooldownSeconds: 20,
    triggeredBy: ['ability', 'empoweredAttack'],
  }]),
  modelled('fated-ashes', [{
    kind: 'dot', id: 'fated-ashes-kindle', name: 'Kindle',
    description: 'Damaging abilities deal 5 bonus magic damage over 3 seconds.',
    support: 'partial',
    // Ticks every 0.5s like Blackfire Torch and Liandry's (measured 2026-09-26).
    supportNotes: 'The extra 15 against monsters is not modelled. Assumed to tick every 0.5s like Blackfire Torch.',
    damageType: 'magic', tickAmount: 5 / 6, tickIntervalSeconds: 0.5, durationSeconds: 3, refresh: 'refresh',
    ratios: [],
  }]),
  modelled('haunting-guise', [{
    kind: 'combatRampAmp', id: 'haunting-guise-madness', name: 'Madness',
    description: 'While in combat with enemy champions, gain 2% increased damage every second, up to 6%.',
    support: 'partial', supportNotes: 'Combat starts at your first hit and never ends within a combo (as Liandry\'s).',
    amountPerStack: 0.02, stackIntervalSeconds: 1, maxStacks: 3,
  }]),
  modelled('bamis-cinder', [{
    kind: 'combatAura', id: 'bamis-cinder-cinders', name: 'Cinders',
    description: 'Deals 10–20 magic damage per second to nearby enemies.',
    support: 'partial', supportNotes: 'The target is assumed to stay in range. Combat is taken to end 3s after your last hit.',
    damage: { type: 'magic', base: { levelRange: { min: 10, max: 20 } }, ratios: [], tags: [] },
    tickIntervalSeconds: 1, combatWindowSeconds: COMBAT_WINDOW_SECONDS,
  }]),
  modelled('mejais-soulstealer', [{
    kind: 'stacking', id: 'mejais-soulstealer-fear', name: 'Fear',
    description: 'Gain 5 Ability Power for each stack of Glory (up to 30 stacks).',
    support: 'partial', supportNotes: 'Glory stacks are an input. The movement speed at 10 stacks is not modelled.',
    stat: 'ap', perStack: 5, maxStacks: 30, stackInputId: 'mejais-glory',
    inputs: stacks('mejais-glory', "Mejai's Soulstealer Glory stacks", 30),
  }]),
  modelled('tear-of-the-goddess', [{
    kind: 'stacking', id: 'tear-of-the-goddess-mana-charge', name: 'Mana Charge',
    description: 'Increases max Mana by 5 every time Mana is spent. Caps at 700 bonus Mana.',
    support: 'partial', supportNotes: 'Charges are an input, not counted from casting.',
    stat: 'mana', perStack: 5, maxStacks: 140, stackInputId: 'tear-of-the-goddess-charges',
    inputs: stacks('tear-of-the-goddess-charges', 'Tear of the Goddess Mana Charge stacks', 140),
  }]),

  // --- Boots ---
  ...(['gluttonous-greaves', 'immortal-boots'] as const).map((id) => modelled(id, [
    {
      kind: 'adaptiveStat', id: `${id}-balance-of-power`, name: 'Balance of Power',
      description: 'Gain 12 Attack Damage or 20 Ability Power (Adaptive).', support: 'full', ad: 12, ap: 20,
    },
    {
      kind: 'stat', id: `${id}-conversion`, name: 'Conversion',
      description: 'Gain 5% Omnivamp, plus 0.5% Omnivamp per takedown participation, up to an additional 5%.',
      support: 'partial', supportNotes: 'Takedown stacks are a separate input.', stat: 'omnivamp', amount: 0.05,
    },
    {
      kind: 'stacking', id: `${id}-conversion-takedowns`, name: 'Conversion (takedowns)',
      description: '0.5% Omnivamp per takedown participation, up to an additional 5%.', support: 'full',
      stat: 'omnivamp', perStack: 0.005, maxStacks: 10, stackInputId: `${id}-takedowns`,
      inputs: stacks(`${id}-takedowns`, 'Takedown participations', 10),
    },
    ...(id === 'immortal-boots' ? [{
      kind: 'damageAmp' as const, id: 'immortal-boots-now-and-forever', name: 'Now and Forever',
      description: 'While above 50% Health, deal 5% bonus damage. While below 50% Health, gain 12% increased '
        + 'Healing and Shielding.',
      support: 'partial' as const, supportNotes: 'Your own Health is a toggle. The healing bonus is not modelled.',
      amount: 0.05, condition: { type: 'toggle' as const, inputId: 'immortal-boots-above-half' },
      inputs: toggle('immortal-boots-above-half', 'Above 50% Health (Immortal Boots)', true),
    }] : []),
  ])),
  modelled('armored-advance', [{
    kind: 'damageReduction', id: 'armored-advance-block', name: 'Block',
    description: 'Basic attacks from champions deal 10% reduced damage to you.',
    support: 'partial', supportNotes: 'As Plated Steelcaps: reduces all physical damage. The Noxian Endurance shield is not modelled.',
    damageType: 'physical', amount: 0.1,
  }]),

  // --- Physical ---
  modelled('wits-end', [{
    kind: 'onHit', id: 'wits-end-at-wits-end', name: "At Wit's End",
    description: 'Basic attacks deal 40 bonus magic damage on hit.', support: 'full', damageType: 'magic', flat: 40,
  }]),
  modelled('terminus', [
    {
      kind: 'onHit', id: 'terminus-shadow', name: 'Shadow',
      description: 'Basic attacks deal 30 bonus magic damage on hit.', support: 'full', damageType: 'magic', flat: 30,
    },
    ...(['pctArmorPen', 'pctMagicPen'] as const).map((stat) => ({
      kind: 'attackStack' as const, id: `terminus-juxtaposition-dark-${stat === 'pctArmorPen' ? 'armor' : 'magic'}`,
      name: 'Juxtaposition (Dark)',
      description: 'Alternate between Light and Dark on-hits when attacking. Dark attacks grant 10% Armor Penetration '
        + 'and 10% Magic Penetration for 5 seconds on hit, stacking up to 3 times. Bonus penetration granted by it '
        + 'is capped at 40%.',
      support: 'partial' as const,
      supportNotes: "The first attack is Light (confirmed 2026-10-02). Light's Armor and Magic Resist are not "
        + 'modelled. The 40% cap never binds: 3 Dark stacks give 30%.',
      stat, amountPerStack: 0.1, maxStacks: 3, durationSeconds: 5, every: 2, startAt: 2,
    })),
  ]),
  modelled('guinsoos-rageblade', [
    {
      kind: 'onHit', id: 'guinsoos-rageblade-wrath', name: 'Wrath',
      description: 'Attacks deal 30 bonus magic damage on hit.', support: 'full', damageType: 'magic', flat: 30,
    },
    {
      kind: 'attackStack', id: SEETHING_STRIKE_ID, name: 'Seething Strike',
      description: 'Basic attacks grant 8% Attack Speed, stacking up to 4 times for a maximum of 32% Attack Speed.',
      support: 'full',
      stat: 'attackSpeed', amountPerStack: 0.08, maxStacks: 4, durationSeconds: 4,
    },
    {
      kind: 'custom', id: 'guinsoos-rageblade-phantom-hit', name: 'Seething Strike (phantom hit)',
      description: 'At max stacks, every 3rd basic attack applies on-hit effects 1 additional time.',
      support: 'partial', supportNotes: 'The extra on-hit application doesn\'t count toward Kraken Slayer or other '
        + 'every-Nth-attack items.',
      handler: 'guinsoos-phantom-hit',
    },
  ]),
  modelled('kraken-slayer', [{
    kind: 'procEveryN', id: 'kraken-slayer-bring-it-down', name: 'Bring It Down',
    description: 'Every third attack deals 150–210 bonus physical damage (120–168 for ranged champions). For every 1% '
      + 'Health the target is missing, this damage increases by 0.75%, capped at 75%.',
    support: 'partial', supportNotes: '150–210 (ranged 120–168) is taken as linear over levels 1–15.',
    n: 3, countsFrom: 'basicAttack', damageType: 'physical', damage: { levelRange: { min: 150, max: 210 } },
    ranged: { damage: { levelRange: { min: 120, max: 168 } } },
    targetMissingHpAmp: { perMissingPct: 0.0075, max: 0.75 }, resetsOnMiss: false,
  }]),
  modelled('hullbreaker', [{
    kind: 'procEveryN', id: 'hullbreaker-skipper', name: 'Skipper',
    description: 'Every 4th attack against champions and epic monsters deals bonus physical damage equal to 160% base '
      + 'Attack Damage + 5% max Health (ranged champions deal 40% of the damage).',
    support: 'partial', supportNotes: 'The structure bonus and Boarding Party are not modelled.',
    n: 4, countsFrom: 'basicAttack', damageType: 'physical', damage: 0, resetsOnMiss: false,
    ratios: [{ stat: 'ad', layer: 'base', value: 1.6 }, { stat: 'hp', value: 0.05 }],
    ranged: { ratios: [{ stat: 'ad', layer: 'base', value: 0.64 }, { stat: 'hp', value: 0.02 }] },
  }]),
  ...([
    ['rapid-firecannon', 'Sharpshooter', 80, ENERGIZED_ATTACKS, 'The Energized attack gains 35% Attack Range, capped at 150, and adds 80 magic damage.'],
    ['stormrazor', 'Bolt', 120, ENERGIZED_ATTACKS, 'The Energized attack adds 120 magic damage on hit and grants 45% Movement Speed for 1.5 seconds.'],
    ['statikk-shiv', 'Electrospark', 60, STATIKK_ENERGIZED_ATTACKS, 'Basic attacks generate 5 additional Energized stacks. The Energized attack fires chain lightning, dealing 60 magic damage.'],
  ] as const).map(([id, name, damage, n, text]) => modelled(id, [{
    kind: 'procEveryN', id: `${id}-energized`, name,
    description: `Movement and basic attacks charge an Energized attack. ${text}`,
    support: 'partial',
    supportNotes: `Charges every ${n} attacks while standing still (confirmed 2026-10-02: 9 energy per attack, 100 `
      + "needed; Statikk Shiv's extra 5 stacks make it 14). Moving also charges it but isn't modelled, so this "
      + 'overcounts attacks needed while kiting. Range, movement speed and bounces to other targets are not modelled.',
    n, countsFrom: 'basicAttack', damageType: 'magic', damage, resetsOnMiss: false,
    startReadyInputId: ENERGIZED_READY, inputs: energizedInput,
  }])),
  modelled('phantom-dancer', [{
    kind: 'attackStack', id: 'phantom-dancer-spectral-waltz', name: 'Spectral Waltz',
    description: 'Landing a basic attack on a champion grants 6% Attack Speed and 1% Movement Speed for 6 seconds, '
      + 'stacking up to 5 times.',
    support: 'partial', supportNotes: 'Movement speed is not modelled.',
    stat: 'attackSpeed', amountPerStack: 0.06, maxStacks: 5, durationSeconds: 6,
  }]),
  modelled('yun-tal-wildarrows', [
    {
      kind: 'stacking', id: 'yun-tal-wildarrows-practice', name: 'Practice Makes Perfect',
      description: 'Each basic attack permanently adds 0.4% Critical Strike Chance for melee champions or 0.2% for '
        + 'ranged champions, capped at 25%.',
      support: 'partial', supportNotes: 'The crit gained before the combo is an input, in percent (0-25), so it '
        + 'works for melee and ranged alike. Attacks in the combo don\'t add more.',
      stat: 'critChance', perStack: 0.01, maxStacks: 25, stackInputId: 'yun-tal-wildarrows-crit',
      inputs: stacks('yun-tal-wildarrows-crit', 'Yun Tal Wildarrows bonus crit chance gained (%)', 25),
    },
    {
      kind: 'attackStack', id: 'yun-tal-wildarrows-flurry', name: 'Flurry',
      description: 'Attacking an enemy champion grants 35% Attack Speed for 6 seconds (25 second Cooldown). Basic '
        + 'attacks reduce the cooldown by 1 second, or 2 seconds when they crit.',
      support: 'partial', supportNotes: 'Starts after the first attack. Attacks don\'t shorten the cooldown here.',
      stat: 'attackSpeed', amountPerStack: 0.35, maxStacks: 1, durationSeconds: 6, cooldownSeconds: 25,
    },
  ]),
  modelled('fiendhunter-bolts', [{
    kind: 'custom', id: 'fiendhunter-bolts-opening-barrage', name: 'Opening Barrage',
    description: 'For 8 seconds after casting your ultimate, your next 3 attacks gain 50% Attack Speed and guaranteed '
      + 'critical strikes at 80% of normal critical damage. An attack that would already crit instead gains 15% bonus '
      + 'true damage (45 second Cooldown).',
    support: 'partial', supportNotes: 'The 15% true damage is an expected value: crit chance x 15% of the attack.',
    handler: 'fiendhunter-opening-barrage',
  }], { ultimateHaste: 20 }),
  modelled('experimental-hexplate', [{
    kind: 'castBuff', id: 'experimental-hexplate-overdrive', name: 'Overdrive',
    description: 'After casting your ultimate ability, gain 40% Attack Speed and 20% Move Speed for 8 seconds '
      + '(30 second Cooldown).',
    support: 'partial', supportNotes: 'Movement speed is not modelled.',
    slots: ['r'], stat: 'attackSpeed', amount: 0.4, durationSeconds: 8, cooldownSeconds: 30,
  }], { ultimateHaste: 20 }),
  modelled('essence-reaver', [{
    kind: 'spellblade', id: 'essence-reaver-spellblade', name: 'Spellblade',
    description: 'After casting an ability, your next basic attack within 10 seconds deals bonus physical damage equal '
      + 'to 135% base Attack Damage + 0–80 (increased by 0.8 per 1% Critical Rate) and restores Mana equal to 50% of '
      + 'the damage dealt. (1.5 second Cooldown)',
    support: 'partial', supportNotes: 'The mana restore is not modelled.',
    damageType: 'physical', bonusDamage: 0, internalCooldownSeconds: 1.5,
    ratios: [{ stat: 'ad', layer: 'base', value: 1.35 }, { stat: 'critChance', value: 80 }],
  }]),
  modelled('divine-sunderer', [{
    kind: 'spellblade', id: 'divine-sunderer-spellblade', name: 'Spellblade',
    description: "After using an ability, your next attack within 10 seconds will deal 10% of the target's maximum "
      + 'Health as bonus physical damage (7% if the attack is ranged). (1.5 second Cooldown)',
    support: 'partial', supportNotes: 'The heal is not modelled.',
    damageType: 'physical', bonusDamage: 0, ratios: [], pctTargetMaxHp: 0.1, internalCooldownSeconds: 1.5,
    ranged: { pctTargetMaxHp: 0.07 },
  }]),
  modelled('iceborn-gauntlet', [{
    kind: 'spellblade', id: 'iceborn-gauntlet-spellblade', name: 'Spellblade',
    description: 'Using an ability causes your next attack within 10 seconds to deal bonus physical damage equal to '
      + '(100% base AD + 25% bonus Armor) in an area and creates an icy field. (1.5 second Cooldown)',
    support: 'partial', supportNotes: 'The slow field is not modelled.',
    damageType: 'physical', bonusDamage: 0, internalCooldownSeconds: 1.5,
    ratios: [{ stat: 'ad', layer: 'base', value: 1 }, { stat: 'armor', layer: 'bonus', value: 0.25 }],
  }]),
  modelled('duskblade-of-draktharr', [{
    kind: 'abilityHitProc', id: 'duskblade-of-draktharr-nightstalker', name: 'Nightstalker',
    description: 'Your first basic attack against an enemy champion deals 60–160 bonus physical damage and slows them '
      + 'by 99% for 0.35 seconds (10 second Cooldown).',
    support: 'partial', supportNotes: '60–160 is taken as linear over levels 1–15. The slow and the takedown reset are not modelled.',
    damageType: 'physical', damage: { levelRange: { min: 60, max: 160 } }, ratios: [], cooldownSeconds: 10,
    triggeredBy: ['basicAttack'],
  }]),
  modelled('titanic-hydra', [{
    kind: 'abilityHitProc', id: 'titanic-hydra-cleave', name: 'Cleave',
    description: 'Every 1.75 seconds, your next attack deals bonus physical damage equal to 25 + 3% bonus Health, '
      + 'creating a shockwave behind the target. Ranged champions deal 75% of the damage.',
    support: 'partial', supportNotes: 'The shockwave only hits enemies behind the target, so it is left out.',
    damageType: 'physical', damage: 25, ratios: [{ stat: 'hp', layer: 'bonus', value: 0.03 }], cooldownSeconds: 1.75,
    ranged: { damage: 18.75, ratios: [{ stat: 'hp', layer: 'bonus', value: 0.0225 }] },
    triggeredBy: ['basicAttack'],
  }]),
  modelled('dominiks-regards', [{
    kind: 'damageAmp', id: 'dominiks-regards-giant-slayer', name: 'Giant Slayer',
    description: "Deal bonus damage based on the enemy champion's bonus Health, up to 12% bonus damage when the enemy "
      + 'champion has 1,200 bonus Health.',
    support: 'partial', supportNotes: 'Taken as linear from 0. A training dummy has no bonus Health, so it gets nothing.',
    amount: 0.12, condition: { type: 'targetIsChampion' }, scaleWithTargetBonusHp: { fullAt: 1200 },
  }]),
  modelled('the-collector', [{
    kind: 'execute', id: 'the-collector-death-and-taxes', name: 'Death and Taxes',
    description: 'If you deal damage to an enemy champion and leave them below 5% of their max Health, they are executed.',
    support: 'partial', supportNotes: 'The permanent threshold growth and bonus gold are not modelled.',
    thresholdFraction: 0.05,
  }]),
  modelled('hexoptics-c44', [{
    kind: 'damageAmp', id: 'hexoptics-c44-magnification', name: 'Magnification',
    description: 'Basic attacks gain 0–10% increased damage with distance from the target, reaching the full bonus at '
      + '550 range.',
    support: 'partial', supportNotes: 'All or nothing: the toggle gives the full 10% (550+ range) or none.',
    amount: 0.1,
    condition: { type: 'allOf', conditions: [{ type: 'toggle', inputId: 'hexoptics-max-range' }, { type: 'sourceKind', value: 'basicAttack' }] },
    inputs: toggle('hexoptics-max-range', 'Attacking from 550+ range (Hexoptics C44)', true),
  }]),
  modelled('overlords-bloodmail', [
    {
      kind: 'statConversion', id: 'overlords-bloodmail-tyranny', name: 'Tyranny',
      description: 'Gain Attack Damage equal to 2.5% of your bonus Health.', support: 'full',
      fromStat: 'hp', fromLayer: 'bonus', toStat: 'ad', ratio: 0.025,
    },
    {
      kind: 'statMultiplier', id: 'overlords-bloodmail-retribution', name: 'Retribution',
      description: 'Gain up to 9% increased Attack Damage based on your missing Health. Reaches the maximum value when '
        + 'below 30% Health.',
      support: 'partial', supportNotes: 'All or nothing: the toggle gives the full 9% (below 30% Health) or none.',
      stat: 'ad', layer: 'total', amount: 0.09,
      condition: { type: 'toggle', inputId: 'overlords-bloodmail-low-health' },
      inputs: toggle('overlords-bloodmail-low-health', "Below 30% Health (Overlord's Bloodmail)"),
    },
  ]),
  modelled('manamune', [
    {
      kind: 'statConversion', id: 'manamune-awe', name: 'Awe',
      description: 'Gain Attack Damage equal to 2% of max Mana and refund 15% of total Mana spent.',
      support: 'partial', supportNotes: 'The mana refund is not modelled.', fromStat: 'mana', toStat: 'ad', ratio: 0.02,
    },
    {
      kind: 'stacking', id: 'manamune-mana-charge', name: 'Mana Charge',
      description: 'Basic attacks and Mana expenditure grant 14 max Mana. Transforms into Muramana at 700 max Mana.',
      support: 'partial', supportNotes: 'Charges are an input. Muramana is not in the data yet.',
      stat: 'mana', perStack: 14, maxStacks: 50, stackInputId: 'manamune-charges',
      inputs: stacks('manamune-charges', 'Manamune Mana Charge stacks', 50),
    },
  ]),
  modelled('galeforce', [{
    kind: 'active', id: 'galeforce-cloudburst', name: 'Cloudburst',
    description: 'Dash in the target direction and fire 3 projectiles at the lowest-Health enemy near the destination, '
      + 'dealing 40–125 (based on level) + 35% bonus Attack Damage physical damage (60 second Cooldown).',
    support: 'partial',
    supportNotes: 'Taken as the total of all 3 projectiles, split evenly: confirmed close enough in game 2026-10-02 '
      + '(level 15 Caitlyn, 60 bonus AD, 100 armor dummy — 26 mitigated per bolt observed vs ~24 predicted). 40–125 '
      + 'is linear over levels 1–15.',
    cooldownSeconds: 60, damageType: 'physical', damage: { levelRange: { min: 40, max: 125 } },
    ratios: [{ stat: 'ad', layer: 'bonus', value: 0.35 }],
  }]),
  modelled('goredrinker', [{
    kind: 'active', id: 'goredrinker-thirsting-slash', name: 'Thirsting Slash',
    description: 'Deal physical damage equal to 175% base Attack Damage to nearby enemies. Restore Health for each '
      + 'enemy champion hit (12 second Cooldown).',
    support: 'partial', supportNotes: 'The heal is not modelled.',
    cooldownSeconds: 12, damageType: 'physical', damage: 0, ratios: [{ stat: 'ad', layer: 'base', value: 1.75 }],
  }], { omnivamp: 0.08 }),
  modelled('stridebreaker', [{
    kind: 'active', id: 'stridebreaker-breaking-shockwave', name: 'Breaking Shockwave',
    description: 'Dash a short distance forward and deal physical damage equal to 100% Attack Damage to nearby enemies. '
      + 'Enemies hit are slowed by 40% for 3 seconds (25 second Cooldown).',
    support: 'partial', supportNotes: 'The dash, slow and Stride movement speed are not modelled.',
    cooldownSeconds: 25, damageType: 'physical', damage: 0, ratios: [{ stat: 'ad', value: 1 }],
  }]),

  // --- Magic ---
  modelled('dusk-and-dawn', [{
    kind: 'spellblade', id: 'dusk-and-dawn-spellblade', name: 'Spellblade',
    description: 'After casting an ability, your next attack deals bonus magic damage equal to 75% base Attack Damage '
      + '+ 10% Ability Power. Shortly afterward, it applies on-hit effects to the target 1 additional time. '
      + '(1.5 second Cooldown)',
    support: 'partial', supportNotes: 'The extra on-hit lands right after the attack. The heal is not modelled.',
    damageType: 'magic', bonusDamage: 0, internalCooldownSeconds: 1.5, extraOnHitApplications: 1,
    ratios: [{ stat: 'ad', layer: 'base', value: 0.75 }, { stat: 'ap', value: 0.1 }],
  }]),
  modelled('abyssal-mask', [{
    kind: 'damageAmp', id: 'abyssal-mask-unmake', name: 'Unmake',
    description: 'All enemy champions within 650 units take 12% increased magic damage.',
    support: 'partial', supportNotes: 'The target is assumed in range. In game it also amplifies allies\' magic damage.',
    amount: 0.12, condition: { type: 'damageType', value: 'magic' },
  }]),
  modelled('imperial-mandate', [{
    kind: 'damageAmp', id: 'imperial-mandate-command', name: 'Command',
    description: 'Crowd-controlling an enemy champion marks them for 4 seconds, causing them to take 7% increased '
      + 'damage during that time.',
    support: 'partial', supportNotes: 'A toggle says whether the target is marked for the whole combo. Control\'s 20 '
      + 'haste for crowd-control abilities is not modelled.',
    amount: 0.07, condition: { type: 'toggle', inputId: 'imperial-mandate-marked' },
    inputs: toggle('imperial-mandate-marked', 'Target marked by Command (Imperial Mandate)'),
  }]),
  modelled('rod-of-ages', ([['hp', 15], ['mana', 30], ['ap', 4]] as const).map(([stat, perStack], index) => ({
    kind: 'stacking' as const, id: `rod-of-ages-veteran-${stat}`, name: 'Veteran',
    description: 'Each stack provides 15 Health, 30 Mana, and 4 Ability Power, stacking at a rate of 1 every 35 '
      + 'seconds. Max of 10 stacks.',
    support: 'partial' as const, supportNotes: 'Stacks are an input. Eternity is not modelled.',
    stat, perStack, maxStacks: 10, stackInputId: 'rod-of-ages-stacks',
    ...(index === 0 && { inputs: stacks('rod-of-ages-stacks', 'Rod of Ages Veteran stacks', 10) }),
  }))),
  modelled('redemption', [{
    kind: 'active', id: 'redemption-salvation', name: 'Salvation',
    description: 'After 2.5 seconds, call down a beam of light that heals allied units and burns enemy champions for '
      + 'true damage equal to 10% of their max Health (60 second Cooldown).',
    support: 'partial', supportNotes: 'The damage lands at once instead of after 2.5 seconds. The heal is not modelled.',
    cooldownSeconds: 60, damageType: 'true', damage: 0, targetMaxHpRatio: 0.1,
  }]),

  // --- Tank ---
  modelled('sunfire-aegis', [{
    kind: 'combatAura', id: 'sunfire-aegis-immolate', name: 'Immolate',
    description: 'While in combat, deals 20 + 1.5% bonus Health magic damage to nearby enemies every second.',
    support: 'partial', supportNotes: 'The target is assumed in range. Combat is taken to end 3s after your last hit.',
    damage: { type: 'magic', base: 20, ratios: [{ stat: 'bonusHp', value: 0.015 }], tags: [] },
    tickIntervalSeconds: 1, combatWindowSeconds: COMBAT_WINDOW_SECONDS,
  }]),
  modelled('hollow-radiance', [{
    kind: 'combatAura', id: 'hollow-radiance-immolate', name: 'Immolate',
    description: 'While in combat, deal magic damage equal to (20–30 + 1% bonus Health) per second to nearby enemies '
      + 'for 5 seconds.',
    support: 'partial', supportNotes: 'The target is assumed in range. 20–30 is linear over levels 1–15. Desolate is not modelled.',
    damage: { type: 'magic', base: { levelRange: { min: 20, max: 30 } }, ratios: [{ stat: 'bonusHp', value: 0.01 }], tags: [] },
    tickIntervalSeconds: 1, combatWindowSeconds: 5,
  }]),
  modelled('unending-despair', [{
    kind: 'combatAura', id: 'unending-despair-anguish', name: 'Anguish',
    description: 'While in combat with champions, every 4 seconds deal magic damage equal to 3% of your maximum Health '
      + 'to nearby enemy champions, and heal yourself for 250% of the damage dealt.',
    support: 'partial', supportNotes: 'First pulse 4s into combat (unverified). The heal is not modelled.',
    damage: { type: 'magic', base: 0, ratios: [{ stat: 'maxHp', value: 0.03 }], tags: [] },
    tickIntervalSeconds: 4, combatWindowSeconds: 4,
  }]),
  modelled('dawnshroud', [{
    kind: 'abilityHitProc', id: 'dawnshroud-dawnbringer', name: 'Dawnbringer',
    description: 'When you immobilize a champion, deal magic damage equal to 40 + 2.5% bonus Health and gain 20% Armor '
      + 'and Magic Resist (3 second Cooldown).',
    support: 'partial', supportNotes: 'A toggle says whether your damaging abilities immobilize. The resists are not modelled.',
    damageType: 'magic', damage: 40, ratios: [{ stat: 'hp', layer: 'bonus', value: 0.025 }], cooldownSeconds: 3,
    condition: { type: 'toggle', inputId: 'dawnshroud-immobilizes' },
    inputs: toggle('dawnshroud-immobilizes', 'Your abilities immobilize (Dawnshroud)'),
  }]),
  modelled('dead-mans-plate', [{
    kind: 'abilityHitProc', id: 'dead-mans-plate-crushing-blow', name: 'Crushing Blow',
    description: 'Attacks deal up to 100 bonus magic damage based on Momentum removed. Attacking removes all Momentum.',
    support: 'partial', supportNotes: 'The first attack of the combo spends full Momentum (toggle); Momentum doesn\'t '
      + 'rebuild within a combo. The slow is not modelled.',
    damageType: 'magic', damage: 100, ratios: [], cooldownSeconds: 0, triggeredBy: ['basicAttack'], oncePerCombo: true,
    condition: { type: 'toggle', inputId: 'dead-mans-plate-full-momentum' },
    inputs: toggle('dead-mans-plate-full-momentum', "Full Momentum at combo start (Dead Man's Plate)", true),
  }]),
  modelled('zekes-convergence', [{
    kind: 'dot', id: 'zekes-convergence-frostfire-tempest', name: 'Frostfire Tempest',
    description: 'Casting your ultimate ability summons a storm around you for 5 seconds. The storm deals 150 total '
      + 'magic damage to enemy champions within 350 units and slows them by 30% (30 second Cooldown).',
    support: 'partial', supportNotes: 'Starts when the ultimate hits; the target is assumed to stay within 350 units. '
      + 'Taken as 30 per second. The 30 second cooldown and the slow are not modelled.',
    damageType: 'magic', tickAmount: 30, tickIntervalSeconds: 1, durationSeconds: 5, refresh: 'ignore', ratios: [],
    condition: { type: 'abilitySlot', value: 'r' },
  }], { ultimateHaste: 10 }),
  modelled('amaranths-twinguard', (['armor', 'mr'] as const).map((stat, index) => ({
    kind: 'statMultiplier' as const, id: `amaranths-twinguard-endurance-${stat}`, name: 'Endurance',
    description: 'While in combat with enemy champions, gain 1 Endurance stack each second, up to 5 stacks. At max '
      + 'stacks, gain 20% Tenacity, 30% bonus Armor, and 30% bonus Magic Resistance.',
    support: 'partial' as const, supportNotes: 'A toggle sets max stacks; taken as +30% of bonus Armor and Magic Resist. '
      + 'Tenacity is not modelled.',
    stat, layer: 'bonus' as const, amount: 0.3,
    condition: { type: 'toggle' as const, inputId: 'amaranths-twinguard-max-stacks' },
    ...(index === 0 && { inputs: toggle('amaranths-twinguard-max-stacks', "Max Endurance stacks (Amaranth's Twinguard)") }),
  }))),

  // --- Support ---
  modelled('ardent-censer', [
    {
      kind: 'stat', id: 'ardent-censer-censer-attack-speed', name: 'Censer',
      description: 'Shielding or healing an allied champion other than yourself empowers both of you for 6 seconds, '
        + 'granting 30% bonus Attack Speed and 25 bonus magic damage on basic attacks.',
      support: 'partial', supportNotes: 'A toggle says whether you are empowered for the whole combo.',
      stat: 'attackSpeed', amount: 0.3, condition: { type: 'toggle', inputId: 'ardent-censer-empowered' },
      inputs: toggle('ardent-censer-empowered', 'Empowered by Ardent Censer'),
    },
    {
      kind: 'onHit', id: 'ardent-censer-censer-on-hit', name: 'Censer (on-hit)',
      description: '25 bonus magic damage on basic attacks while empowered.', support: 'partial',
      supportNotes: 'Uses the Ardent Censer toggle.',
      damageType: 'magic', flat: 25, condition: { type: 'toggle', inputId: 'ardent-censer-empowered' },
    },
  ]),
  modelled('staff-of-flowing-water', ([['ap', 40], ['abilityHaste', 15]] as const).map(([stat, amount], index) => ({
    kind: 'stat' as const, id: `staff-of-flowing-water-rapids-${stat}`, name: 'Rapids',
    description: 'Shielding or healing an allied champion other than yourself empowers both of you for 6 seconds, '
      + 'granting 40 Ability Power and 15 Ability Haste.',
    support: 'partial' as const, supportNotes: 'A toggle says whether you are empowered for the whole combo.',
    stat, amount, condition: { type: 'toggle' as const, inputId: 'staff-of-flowing-water-empowered' },
    ...(index === 0 && { inputs: toggle('staff-of-flowing-water-empowered', 'Empowered by Staff of Flowing Water') }),
  }))),
  modelled('yordle-trap', [{
    kind: 'stat', id: 'yordle-trap-catcher', name: 'Catcher',
    description: 'Slowing or immobilizing an enemy champion inspires you for 8 seconds: gain 20 Movement Speed and 30% '
      + 'bonus Attack Speed (20% for ranged champions).',
    support: 'partial', supportNotes: 'A toggle says whether you are Inspired for the whole combo.',
    stat: 'attackSpeed', amount: 0.3, condition: { type: 'toggle', inputId: 'yordle-trap-inspired' },
    ranged: { amount: 0.2 },
    inputs: toggle('yordle-trap-inspired', 'Inspired (Yordle Trap)'),
  }]),
  modelled('spectral-sickle', [{
    kind: 'adaptiveStat', id: 'spectral-sickle-versatile', name: 'Versatile',
    description: 'Gain 10 Attack Damage or 20 Ability Power (Adaptive).', support: 'full', ad: 10, ap: 20,
  }]),
]
