import type { Effect, Rune } from '@wr-calc/schema'

// Runes, first modelled 2026-10-02 from wrpocket's 7.3a text (snapshots/wrpocket/7.3a/runes.json; the patch pipeline
// snapshots runes and lists any text change in PATCH_DIFF.md, but never edits this file). Every rune is listed so a build can name it; only effects that move a 1v1 damage number
// are modelled, and nothing here has been checked in game. Assumptions are in each effect's supportNotes and in
// docs/test-sheets/pending-checks.md. Values that differ for ranged champions are in each effect's `ranged`.

const toggle = (id: string, label: string, defaultOn = false) => [{ type: 'boolean' as const, id, label, default: defaultOn }]
const stacks = (id: string, label: string, max: number) => [{ type: 'stackCount' as const, id, label, min: 0, max, default: 0 }]
const level = (min: number, max: number) => ({ levelRange: { min, max } })

function rune(id: string, name: string, path: string, slot: string, effects: Effect[] = []): Rune {
  return { id, name, path, slot, effects }
}

const KEYSTONES: Rune[] = [
  rune('electrocute', 'Electrocute', 'Keystone', 'keystone', [{
    kind: 'hitStackProc', id: 'electrocute-proc', name: 'Electrocute',
    description: 'Basic attacks and abilities generate stacks on enemy champions hit, up to one per attack or cast. '
      + 'Applying 3 stacks within 3 seconds deals 40 - 210 (based on level) (+10% bonus AD) (+5% AP) Adaptive damage. '
      + 'Cooldown: 20-13 seconds.',
    support: 'partial', supportNotes: 'The 3-second window is taken as 3 seconds from the latest stack.',
    stacksToProc: 3, stackWindowSeconds: 3, cooldownSeconds: level(20, 13), stacksFrom: ['basicAttack', 'ability'],
    damage: { type: 'physical', base: level(40, 210), ratios: [{ stat: 'bonusAd', value: 0.1 }, { stat: 'ap', value: 0.05 }], tags: [] },
    adaptive: true, delivery: { kind: 'instant' },
  }]),
  rune('dark-harvest', 'Dark Harvest', 'Keystone', 'keystone', [{
    kind: 'abilityHitProc', id: 'dark-harvest-proc', name: 'Dark Harvest',
    description: 'Damaging a champion below 50% Health deals adaptive damage and harvests their soul. (20 second '
      + 'cooldown.) Damage: 35 + 11 per soul (+10% bonus AD +5% bonus AP).',
    support: 'partial', supportNotes: 'Souls are an input. The target\'s Health is checked after the hit lands.',
    damageType: 'adaptive', damage: 35, damagePerStack: { inputId: 'dark-harvest-souls', amount: 11 },
    ratios: [{ stat: 'ad', layer: 'bonus', value: 0.1 }, { stat: 'ap', value: 0.05 }], cooldownSeconds: 20,
    triggeredBy: ['ability', 'basicAttack'], condition: { type: 'targetHpBelow', threshold: 0.5 },
    inputs: stacks('dark-harvest-souls', 'Dark Harvest souls', 100),
  }]),
  rune('empowerment', 'Empowerment', 'Keystone', 'keystone', [
    {
      kind: 'hitStackProc', id: 'empowerment-proc', name: 'Empowerment',
      description: 'Hitting an enemy champion with 3 consecutive attacks deals 40 - 165 bonus adaptive damage (based on level).',
      support: 'partial', supportNotes: 'Taken as 3 attacks within 3 seconds of each other, once per combo.',
      stacksToProc: 3, stackWindowSeconds: 3, cooldownSeconds: 600, stacksFrom: ['basicAttack'],
      damage: { type: 'physical', base: level(40, 165), ratios: [], tags: [] }, adaptive: true, delivery: { kind: 'instant' },
    },
    {
      kind: 'damageAmp', id: 'empowerment-amp', name: 'Empowerment (damage)',
      description: 'After the proc, increases your damage dealt by 8%, lasting until you exit combat with champions.',
      support: 'partial', supportNotes: 'A toggle says whether it is active for the whole combo; it doesn\'t switch on '
        + 'after the third attack yet.',
      amount: 0.08, condition: { type: 'toggle', inputId: 'empowerment-active' },
      inputs: toggle('empowerment-active', 'Empowerment active (8% damage)'),
    },
  ]),
  rune('lethal-tempo', 'Lethal Tempo', 'Keystone', 'keystone', [{
    kind: 'attackStack', id: 'lethal-tempo-attack-speed', name: 'Lethal Tempo',
    description: 'Hitting enemy champions with basic attacks grants stacking Attack Speed, up to 6 stacks. Each stack '
      + 'grants 8% (melee) or 6.4% (ranged) Attack Speed for 6 seconds.',
    support: 'partial', supportNotes: 'The bolt at max stacks (9-30 adaptive) is not modelled.',
    stat: 'attackSpeed', amountPerStack: 0.08, maxStacks: 6, durationSeconds: 6, ranged: { amountPerStack: 0.064 },
  }]),
  rune('fleet-footwork', 'Fleet Footwork', 'Keystone', 'keystone', []),
  rune('conqueror', 'Conqueror', 'Keystone', 'keystone', [{
    kind: 'attackStack', id: 'conqueror-stacks', name: 'Conqueror',
    description: 'Basic attacks and abilities generate stacks on enemy champions hit, up to one per attack or cast, '
      + 'stacking up to 6 times. Each stack lasts 6 seconds and grants 3 - 5 (based on level) bonus Attack Damage or '
      + '5 - 8.33 (based on level) Ability Power (Adaptive).',
    support: 'partial', supportNotes: 'The omnivamp at full stacks is not modelled. AD or AP is picked from your stats '
      + 'before combat.',
    adaptive: { ad: level(3, 5), ap: level(5, 8.33) }, stacksFrom: ['basicAttack', 'ability'], maxStacks: 6,
    durationSeconds: 6,
  }]),
  rune('grasp-of-undying', 'Grasp of Undying', 'Keystone', 'keystone', [
    {
      kind: 'abilityHitProc', id: 'grasp-of-undying-attack', name: 'Grasp of the Undying',
      description: 'After 4 stacks (one per second in combat), your next basic attack against an enemy champion deals '
        + '3.3% of your maximum health in bonus magic damage. On ranged champions, all effects are reduced by 60%.',
      support: 'partial', supportNotes: 'Taken as ready on the first attack and every 4 seconds after.',
      damageType: 'magic', damage: 0, ratios: [{ stat: 'hp', value: 0.033 }], cooldownSeconds: 4, triggeredBy: ['basicAttack'],
      ranged: { ratios: [{ stat: 'hp', value: 0.0132 }] },
    },
    {
      kind: 'stacking', id: 'grasp-of-undying-health', name: 'Grasp of the Undying (Health)',
      description: 'Each proc permanently grants 10 bonus health (4 for ranged champions).', support: 'full',
      stat: 'hp', perStack: 10, ranged: { perStack: 4 }, maxStacks: 100, stackInputId: 'grasp-of-undying-stacks',
      inputs: stacks('grasp-of-undying-stacks', 'Grasp of the Undying procs so far', 100),
    },
  ]),
  rune('guardian', 'Guardian', 'Keystone', 'keystone', []),
  rune('aery', 'Aery', 'Keystone', 'keystone', [{
    kind: 'abilityHitProc', id: 'aery-damage', name: 'Summon Aery',
    description: 'Basic attacks and abilities against an enemy champion send Aery to them, dealing 15 - 70 (based on '
      + 'level) (+10% bonus AD) (+5% AP) Adaptive damage. She cannot be sent out again until she returns.',
    support: 'partial', supportNotes: 'Her round trip is taken as 2 seconds (unverified); travel time is ignored.',
    damageType: 'adaptive', damage: level(15, 70), ratios: [{ stat: 'ad', layer: 'bonus', value: 0.1 }, { stat: 'ap', value: 0.05 }],
    cooldownSeconds: 2, triggeredBy: ['ability', 'basicAttack'],
  }]),
  rune('arcane-comet', 'Arcane Comet', 'Keystone', 'keystone', [{
    kind: 'abilityHitProc', id: 'arcane-comet-damage', name: 'Arcane Comet',
    description: 'Damaging a champion with an ability hurls a comet at their location. Damage: 15 - 100 + (2 x total '
      + 'hits on enemy champions) + 10% bonus Attack Damage + 5% Ability Power. Cooldown: 16-8 seconds.',
    support: 'partial', supportNotes: 'Always hits, with no travel time. The +2 per earlier hit is not modelled.',
    damageType: 'adaptive', damage: level(15, 100), ratios: [{ stat: 'ad', layer: 'bonus', value: 0.1 }, { stat: 'ap', value: 0.05 }],
    cooldownSeconds: level(16, 8),
  }]),
  rune('phase-rush', 'Phase Rush', 'Keystone', 'keystone', []),
  rune('first-strike', 'First Strike', 'Keystone', 'keystone', [{
    kind: 'damageAmp', id: 'first-strike-bonus', name: 'First Strike',
    description: 'Dealing damage to an enemy champion right after engaging grants a First Strike effect for 3s, letting '
      + 'you deal 7% bonus true damage to them. (20-13s cooldown)',
    support: 'partial', supportNotes: 'Taken as a 7% amplifier on the whole combo (in game: 3 seconds, as true damage).',
    amount: 0.07, condition: { type: 'targetIsChampion' },
  }]),
  rune('ice-overlord', 'Ice Overlord', 'Keystone', 'keystone', [{
    kind: 'abilityHitProc', id: 'ice-overlord-explosion', name: 'Ice Overlord',
    description: 'Immobilizing an enemy champion creates ice beneath them and a protective layer of ice around you. After '
      + 'a delay of 2.5s, the ice explodes, dealing 15-100 + 5% Bonus Health magic damage around you.',
    support: 'partial', supportNotes: 'A toggle says whether your abilities immobilize; the 2.5s delay and the resists '
      + 'are not modelled.',
    damageType: 'magic', damage: level(15, 100), ratios: [{ stat: 'hp', layer: 'bonus', value: 0.05 }], cooldownSeconds: 20,
    condition: { type: 'toggle', inputId: 'ice-overlord-immobilizes' },
    inputs: toggle('ice-overlord-immobilizes', 'Your abilities immobilize (Ice Overlord)'),
  }]),
]

const DOMINATION: Rune[] = [
  rune('cheap-shot', 'Cheap Shot', 'Domination', '0', [{
    kind: 'abilityHitProc', id: 'cheap-shot-damage', name: 'Cheap Shot',
    description: 'Deals 10 - 45 bonus true damage to enemies whose movement is impaired. (7 seconds cooldown).',
    support: 'partial', supportNotes: 'A toggle says whether the target is impaired for the whole combo.',
    damageType: 'true', damage: level(10, 45), ratios: [], cooldownSeconds: 7, triggeredBy: ['ability', 'basicAttack'],
    condition: { type: 'toggle', inputId: 'cheap-shot-impaired' },
    inputs: toggle('cheap-shot-impaired', 'Target movement impaired (Cheap Shot)'),
  }]),
  rune('sudden-impact', 'Sudden Impact', 'Domination', '0', [{
    kind: 'abilityHitProc', id: 'sudden-impact-damage', name: 'Sudden Impact',
    description: 'Damaging an enemy champion deals a bonus 15–65 true damage after using a dash, leap, blink, teleport, '
      + 'or when exiting stealth for 4s. (15s cooldown) Level 5: +5 true damage. Level 9: another +5.',
    support: 'partial', supportNotes: 'A toggle says whether you dashed just before. 15–65 is linear over levels; the '
      + 'level 5 and 9 bonuses are added as +5 and +10 from those levels.',
    damageType: 'true', damage: { byLevel: [15, 18.57, 22.14, 25.71, 34.29, 37.86, 41.43, 45, 53.57, 57.14, 60.71, 64.29, 67.86, 71.43, 75] },
    ratios: [], cooldownSeconds: 15, triggeredBy: ['ability', 'basicAttack'],
    condition: { type: 'toggle', inputId: 'sudden-impact-dashed' },
    inputs: toggle('sudden-impact-dashed', 'Dashed before hitting (Sudden Impact)'),
  }]),
  rune('empowered-attack', 'Empowered Attack', 'Domination', '0', [{
    kind: 'abilityHitProc', id: 'empowered-attack-damage', name: 'Empowered Attack',
    description: 'Every 8 seconds, the next attack will be empowered, dealing 20 - 60 bonus adaptive damage. Ranged '
      + 'champions deal 80% damage.',
    support: 'full',
    damageType: 'adaptive', damage: level(20, 60), ratios: [], cooldownSeconds: 8, triggeredBy: ['basicAttack'],
    ranged: { damage: level(16, 48) },
  }]),
  rune('chain-assault', 'Chain Assault', 'Domination', '1', [{
    kind: 'abilityHitProc', id: 'chain-assault-damage', name: 'Chain Assault',
    description: 'Hitting an enemy champion with an active ability marks them: your next 2 attacks or ability casts '
      + 'against them deal 12 - 38 (+3% bonus AD +1.5% bonus AP) bonus adaptive damage. (15 second cooldown)',
    support: 'partial', supportNotes: 'Both marked hits are dealt at once on the marking hit (total right, timing early).',
    damageType: 'adaptive', damage: level(24, 76), ratios: [{ stat: 'ad', layer: 'bonus', value: 0.06 }, { stat: 'ap', value: 0.03 }],
    cooldownSeconds: 15,
  }]),
  rune('tyrant', 'Tyrant', 'Domination', '1', [{
    kind: 'abilityHitProc', id: 'tyrant-damage', name: 'Tyrant',
    description: 'When damaging a champion below 50% Health, deal 20 - 70 (+6% bonus AD +3% AP) bonus adaptive '
      + 'damage. (10 second cooldown)',
    support: 'partial', supportNotes: 'The target\'s Health is checked after the hit lands.',
    damageType: 'adaptive', damage: level(20, 70), ratios: [{ stat: 'ad', layer: 'bonus', value: 0.06 }, { stat: 'ap', value: 0.03 }],
    cooldownSeconds: 10, triggeredBy: ['ability', 'basicAttack'], condition: { type: 'targetHpBelow', threshold: 0.5 },
  }]),
  rune('hubris', 'Hubris', 'Domination', '1', []),
  rune('eyeball-collection', 'Eyeball Collection', 'Domination', '2', [{
    kind: 'adaptiveStat', id: 'eyeball-collection-stacks', name: 'Eyeball Collection',
    description: 'Gain 1.5 Attack Damage or 3 Ability Power after scoring a champion or epic monster takedown, stacking up to 8 times.',
    support: 'full', ad: 1.5, ap: 3, stackInputId: 'eyeball-collection-stacks', maxStacks: 8,
    inputs: stacks('eyeball-collection-stacks', 'Eyeball Collection stacks', 8),
  }]),
  rune('relentless-hunter', 'Relentless Hunter', 'Domination', '2', []),
  rune('zombie-ward', 'Zombie Ward', 'Domination', '2', [{
    kind: 'adaptiveStat', id: 'zombie-ward-stacks', name: 'Zombie Ward',
    description: 'Takedowns on enemy wards grant 3 Attack Damage or 6 Ability Power (max 5 stacks).',
    support: 'full', ad: 3, ap: 6, stackInputId: 'zombie-ward-stacks', maxStacks: 5,
    inputs: stacks('zombie-ward-stacks', 'Zombie Ward stacks', 5),
  }]),
]

const PRECISION: Rune[] = [
  rune('brutal', 'Brutal', 'Precision', '0', [{
    kind: 'onHit', id: 'brutal-damage', name: 'Brutal',
    description: 'Attacks deal 5 (+ 6% Bonus Attack Damage + 3% Ability Power) bonus adaptive damage to enemy champions.',
    support: 'full', damageType: 'adaptive', flat: 5,
    ratios: [{ stat: 'ad', layer: 'bonus', value: 0.06 }, { stat: 'ap', value: 0.03 }],
  }]),
  rune('triumph', 'Triumph', 'Precision', '0', []),
  rune('battle-zeal', 'Battle Zeal', 'Precision', '0', [{
    kind: 'combatRampAmp', id: 'battle-zeal-amp', name: 'Battle Zeal',
    description: 'While in combat with an enemy champion, gain 1.4% basic ability damage amplification against them '
      + 'every 1s, stacking up to 3 times for a maximum of 4.2%.',
    support: 'partial', supportNotes: 'Amplifies all ability damage, the ultimate included (it should be basic abilities only).',
    amountPerStack: 0.014, stackIntervalSeconds: 1, maxStacks: 3, condition: { type: 'sourceKind', value: 'ability' },
  }]),
  rune('last-stand', 'Last Stand', 'Precision', '1', [{
    kind: 'damageAmp', id: 'last-stand-amp', name: 'Last Stand',
    description: 'When health is lower than 60%, attacks launched at enemy champions deal 5-11% bonus adaptive damage.',
    support: 'partial', supportNotes: 'A toggle gives the full 11% (very low Health); it scales from 5% in game. '
      + 'Applied to all damage.',
    amount: 0.11, condition: { type: 'toggle', inputId: 'last-stand-low-health' },
    inputs: toggle('last-stand-low-health', 'Low Health (Last Stand)'),
  }]),
  rune('cut-down', 'Cut Down', 'Precision', '1', [{
    kind: 'damageAmp', id: 'cut-down-amp', name: 'Cut Down',
    description: 'Your attacks deal 6.5% bonus adaptive damage to enemy champions with more than 60% Health.',
    support: 'partial', supportNotes: 'Applied to all damage (unverified whether abilities count).',
    amount: 0.065, condition: { type: 'targetHpAbove', threshold: 0.6 },
  }]),
  rune('coup-de-grace', 'Coup de Grace', 'Precision', '1', [{
    kind: 'damageAmp', id: 'coup-de-grace-amp', name: 'Coup de Grace',
    description: 'When an enemy has less than 40% health, deals 8% bonus adaptive damage.', support: 'full',
    amount: 0.08, condition: { type: 'targetHpBelow', threshold: 0.4 },
  }]),
  rune('legend-alacrity', 'Legend Alacrity', 'Precision', '2', [{
    kind: 'stacking', id: 'legend-alacrity-stacks', name: 'Legend: Alacrity',
    description: 'Gain 3% bonus attack speed per stack, up to 18% at maximum stacks.', support: 'full',
    stat: 'attackSpeed', perStack: 0.03, maxStacks: 6, stackInputId: 'legend-alacrity-stacks',
    inputs: stacks('legend-alacrity-stacks', 'Legend: Alacrity stacks', 6),
  }]),
  rune('legend-haste', 'Legend: Haste', 'Precision', '2', [{
    kind: 'stacking', id: 'legend-haste-stacks', name: 'Legend: Haste',
    description: '1.5 Ability Haste per stack, up to 15 Ability Haste.', support: 'full',
    stat: 'abilityHaste', perStack: 1.5, maxStacks: 10, stackInputId: 'legend-haste-stacks',
    inputs: stacks('legend-haste-stacks', 'Legend: Haste stacks', 10),
  }]),
  rune('legend-bloodline', 'Legend Bloodline', 'Precision', '2', [{
    kind: 'stacking', id: 'legend-bloodline-stacks', name: 'Legend: Bloodline',
    description: 'Gain 1% omnivamp per stack, up to 7%.', support: 'full',
    stat: 'omnivamp', perStack: 0.01, maxStacks: 7, stackInputId: 'legend-bloodline-stacks',
    inputs: stacks('legend-bloodline-stacks', 'Legend: Bloodline stacks', 7),
  }]),
]

const RESOLVE: Rune[] = [
  rune('demolish', 'Demolish', 'Resolve', '0'),
  rune('font-of-life', 'Font of Life', 'Resolve', '0'),
  rune('courage-of-the-colossus', 'Courage of the Colossus', 'Resolve', '0'),
  rune('unshakeable', 'Unshakeable', 'Resolve', '0', (['armor', 'mr'] as const).map((stat) => ({
    kind: 'statMultiplier' as const, id: `unshakeable-${stat}`, name: 'Unshakeable',
    description: 'Gain 3% Armor and Magic Resist. For every 1 enemy champion nearby, gain an additional 2%.',
    support: 'partial' as const, supportNotes: 'Only the base 3%; nearby enemies are not modelled.',
    stat, layer: 'total' as const, amount: 0.03,
  }))),
  rune('second-wind', 'Second Wind', 'Resolve', '1'),
  rune('nullifying-orb', 'Nullifying Orb', 'Resolve', '1'),
  rune('bone-plating', 'Bone Plating', 'Resolve', '1'),
  rune('overgrowth', 'Overgrowth', 'Resolve', '2', [{
    kind: 'stacking', id: 'overgrowth-stacks', name: 'Overgrowth',
    description: 'When 3 monsters or 3 minions are killed nearby, permanently gain 3 Max Health.',
    support: 'partial', supportNotes: 'Stacks are an input; the 3% at 30 stacks is not modelled.',
    stat: 'hp', perStack: 3, maxStacks: 200, stackInputId: 'overgrowth-stacks',
    inputs: stacks('overgrowth-stacks', 'Overgrowth stacks', 200),
  }]),
  rune('revitalize', 'Revitalize', 'Resolve', '2'),
  rune('perseverance', 'Perseverance', 'Resolve', '2', [{
    kind: 'stat', id: 'perseverance-tenacity', name: 'Perseverance',
    description: 'Gain 10% tenacity.', support: 'partial', supportNotes: 'The resists while immobilized are not modelled.',
    stat: 'tenacity', amount: 0.1,
  }]),
]

const SORCERY: Rune[] = [
  rune('axiom-arcanist', 'Axiom Arcanist', 'Sorcery', '0', [{
    kind: 'damageAmp', id: 'axiom-arcanist-amp', name: 'Axiom Arcanist',
    description: 'Your ultimate ability has 10% increased damage, healing, and shielding. (AoE damage is reduced to a 5% increase)',
    support: 'partial', supportNotes: 'Single-target value; area ultimates should get 5%.',
    amount: 0.1, condition: { type: 'abilitySlot', value: 'r' },
  }]),
  rune('manaflow-band', 'Manaflow Band', 'Sorcery', '0', [{
    kind: 'stacking', id: 'manaflow-band-stacks', name: 'Manaflow Band',
    description: 'Hitting an enemy champion with an ability or empowered attack permanently increases your max mana by 30, up to 300 mana.',
    support: 'full', stat: 'mana', perStack: 30, maxStacks: 10, stackInputId: 'manaflow-band-stacks',
    inputs: stacks('manaflow-band-stacks', 'Manaflow Band stacks', 10),
  }]),
  rune('botanist', 'Botanist', 'Sorcery', '0'),
  rune('hextech-flashtraption', 'Hextech Flashtraption', 'Sorcery', '0'),
  rune('transcendence', 'Transcendence', 'Sorcery', '1', [{
    kind: 'stat', id: 'transcendence-haste', name: 'Transcendence',
    description: 'Level 1: Gain 5 Ability Haste. Level 5: Gain an additional 5 Ability Haste.',
    support: 'partial', supportNotes: 'The level 9 cooldown refund is not modelled.',
    stat: 'abilityHaste', amount: { byLevel: [5, 5, 5, 5, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
  }]),
  rune('celerity', 'Celerity', 'Sorcery', '1'),
  rune('absolute-focus', 'Absolute Focus', 'Sorcery', '1', [{
    kind: 'adaptiveStat', id: 'absolute-focus-bonus', name: 'Absolute Focus',
    description: 'While above 65% Health, gain a bonus 2 - 20 Attack Damage or 2 - 30 Ability Power (Adaptive).',
    support: 'partial', supportNotes: 'A toggle says whether you stay above 65% Health for the whole combo.',
    ad: level(2, 20), ap: level(2, 30), condition: { type: 'toggle', inputId: 'absolute-focus-healthy' },
    inputs: toggle('absolute-focus-healthy', 'Above 65% Health (Absolute Focus)', true),
  }]),
  rune('scorch', 'Scorch', 'Sorcery', '2', [{
    kind: 'abilityHitProc', id: 'scorch-damage', name: 'Scorch',
    description: 'Dealing ability damage to a champion deals an additional 21-49 magic damage after 1 second. Cooldown: 8s',
    support: 'partial', supportNotes: 'Lands with the ability instead of 1 second later.',
    damageType: 'magic', damage: level(21, 49), ratios: [], cooldownSeconds: 8,
  }]),
  rune('nimbus-cloak', 'Nimbus Cloak', 'Sorcery', '2'),
  rune('gathering-storm', 'Gathering Storm', 'Sorcery', '2'),
  rune('ixtali-seedjar', 'Ixtali Seedjar', 'Sorcery', '2'),
]

export const RUNES_7_3A: Rune[] = [...KEYSTONES, ...DOMINATION, ...PRECISION, ...RESOLVE, ...SORCERY]
