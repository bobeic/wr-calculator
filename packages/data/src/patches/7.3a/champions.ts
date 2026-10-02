import type { Champion } from '@wr-calc/schema'
import { byLevelLine, magic, modelled, physical, utility } from './champion-helpers'
import { HAND_MODELED_CHAMPIONS_BATCH2 } from './champions-batch2'
import { HAND_MODELED_CHAMPIONS_BATCH3 } from './champions-batch3'
import { HAND_MODELED_CHAMPIONS_BATCH4 } from './champions-batch4'
import { HAND_MODELED_CHAMPIONS_BATCH5 } from './champions-batch5'
import { HAND_MODELED_CHAMPIONS_BATCH6 } from './champions-batch6'
import { HAND_MODELED_CHAMPIONS_BATCH7 } from './champions-batch7'
import { HAND_MODELED_CHAMPIONS_BATCH8 } from './champions-batch8'
import { HAND_MODELED_CHAMPIONS_BATCH9 } from './champions-batch9'
import { HAND_MODELED_CHAMPIONS_BATCH10 } from './champions-batch10'
import { HAND_MODELED_CHAMPIONS_BATCH11 } from './champions-batch11'
import { HAND_MODELED_CHAMPIONS_BATCH12 } from './champions-batch12'
import { HAND_MODELED_CHAMPIONS_BATCH13 } from './champions-batch13'
import { HAND_MODELED_CHAMPIONS_BATCH14 } from './champions-batch14'
import { HAND_MODELED_CHAMPIONS_BATCH15 } from './champions-batch15'

// Hand-modelled kits for the most-picked champion in each lane on the CN server (CN_STATS, all ranks, 2026-09-30):
// Darius (Baron), Lee Sin (Jungle), Hwei (Mid), Caitlyn (Dragon) and Senna (Support). Numbers come from wrpocket's 7.3a
// ability text and scaling rows; base stats and attack speed sync from the generated entry. Nothing here has been
// checked in game yet. Each kit models one-on-one damage dealt: shields, heals, slows, crowd control, movement and
// resource costs beyond the listed cost are left out. Hwei's nine spells are variants of his Q, W and E. Wind-up times marked "League" are League of Legends values,
// kept because they move time-to-kill; they are not timed in Wild Rift.

const HEMORRHAGE_ID = 'darius-passive-hemorrhage'

const DARIUS = modelled('darius', {
  passive: {
    id: 'darius-passive', name: 'HEMORRHAGE', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'dot', id: HEMORRHAGE_ID, name: 'Hemorrhage',
        description: 'Attacks cause enemies to bleed, dealing 18 (+40% bonus AD) physical damage over 5 seconds. '
          + 'Can stack up to 5 times.',
        support: 'partial',
        supportNotes: 'Ticks once a second (assumed). Applied by attacks, Decimate (assumed to hit with the blade) and '
          + 'Noxian Guillotine; each application refreshes every stack. Full stacks at once during Noxian Might and the '
          + '180% damage to monsters are not modelled.',
        damageType: 'physical', tickAmount: 18 / 5, tickIntervalSeconds: 1, durationSeconds: 5,
        refresh: 'stack', maxStacks: 5, appliedBy: ['basicAttack', 'q', 'r'],
        ratios: [{ stat: 'ad', layer: 'bonus', value: 0.4 / 5 }],
      },
      {
        kind: 'attackStack', id: 'darius-passive-noxian-might', name: 'Noxian Might',
        description: 'Upon reaching full stacks, Darius gains Noxian Might for 5 seconds, gaining 32 (based on level) '
          + 'Attack Damage.',
        support: 'partial',
        // In game, 2026-10-03: 236 AD at level 15. Level 1 is the text's 32; levels between assume a straight line.
        supportNotes: 'Only level 1 (32, from the text) and level 15 (236, read in game) are known; levels between '
          + "assume a straight line. Counted from Darius's 5th, 10th, ... damaging hit (attacks and abilities), not "
          + "from the target's Hemorrhage stacks.",
        stat: 'ad', amountPerStack: byLevelLine(32, 236), stacksFrom: ['basicAttack', 'ability'], maxStacks: 1, durationSeconds: 5,
        every: 5, startAt: 5,
      },
    ],
  },
  q: {
    id: 'darius-q', name: 'DECIMATE', maxRank: 4, cooldown: { byRank: [9.5, 8, 6.5, 5] },
    cost: { byRank: [35, 40, 45, 50] },
    // League's 0.75 s wind-up. The blade hit (the 1v1 case); the handle's light damage and the heal aren't modelled.
    castTime: 0.75, flags: {},
    damage: [physical({ byRank: [50, 90, 130, 170] }, [{ stat: 'totalAd', value: { byRank: [1, 1.15, 1.3, 1.45] } }])],
  },
  w: {
    id: 'darius-w', name: 'CRIPPLING STRIKE', maxRank: 4, cooldown: 5.5, cost: 30, castTime: 0, damage: [],
    flags: { resetsBasicAttack: true },
    effects: [{
      kind: 'empoweredAttack', id: 'darius-w-crippling-strike', name: 'Crippling Strike',
      description: 'Empowers his next attack within 8 seconds to deal an additional 30% AD physical damage.',
      support: 'partial', supportNotes: 'The slow and the refund on a kill are not modelled.',
      grant: { on: 'abilityCast', slots: ['w'] }, maxCharges: 1, durationSeconds: 8,
      bonus: physical(0, [{ stat: 'totalAd', value: { byRank: [0.3, 0.4, 0.5, 0.6] } }]),
    }],
  },
  e: {
    ...utility('darius-e', 'APPREHEND', 4, { byRank: [18, 16, 14, 12] }, 45),
    effects: [{
      kind: 'stat', id: 'darius-e-armor-pen', name: 'Apprehend (passive)', description: 'Gains 15% Armor Penetration.',
      support: 'full', stat: 'pctArmorPen', amount: { byRank: [0.15, 0.22, 0.29, 0.36] },
    }],
  },
  r: {
    id: 'darius-r', name: 'NOXIAN GUILLOTINE', maxRank: 3, cooldown: { byRank: [70, 65, 60] },
    cost: { byRank: [100, 100, 0] }, castTime: 0, flags: {},
    damage: [{ type: 'true', base: { byRank: [125, 250, 375] }, ratios: [{ stat: 'bonusAd', value: 0.75 }], tags: [] }],
    effects: [{
      kind: 'damageAmp', id: 'darius-r-hemorrhage-amp', name: 'Noxian Guillotine (Hemorrhage)',
      description: 'Damage increased by 20% per Hemorrhage stack.',
      // In game, 2026-10-03: 375 true damage at rank 3 with no bonus AD, doubled at 5 Hemorrhage stacks.
      support: 'partial', supportNotes: 'The reset on a kill is not modelled.',
      condition: { type: 'abilitySlot', value: 'r' }, amount: 0.2, perTargetDotStack: { effectId: HEMORRHAGE_ID },
    }],
  },
})

const LEE_SIN = modelled('lee-sin', {
  passive: {
    id: 'lee-sin-passive', name: 'Flurry', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'castBuff', id: 'lee-sin-passive-flurry', name: 'Flurry',
      description: "Lee Sin's abilities grant him 40% Attack Speed for 2 attacks within 3 seconds.",
      support: 'partial', supportNotes: 'The Energy it restores is not modelled.',
      slots: ['q', 'w', 'e', 'r'], stat: 'attackSpeed', amount: 0.4, durationSeconds: 3, cooldownSeconds: 0, charges: 2,
    }],
  },
  q: {
    id: 'lee-sin-q', name: 'Sonic Wave', maxRank: 4, cooldown: { byRank: [8, 7, 6, 5] }, cost: 50, castTime: 0, flags: {},
    damage: [physical({ byRank: [60, 100, 140, 180] }, [{ stat: 'bonusAd', value: 0.9 }])],
    stages: [{
      // Resonating Strike doubles from full to no Health ("based on its missing Health"), taken as a straight line.
      id: 'lee-sin-q-resonating-strike', name: 'Resonating Strike', trigger: 'press', windowSeconds: 3,
      damage: [physical({ byRank: [60, 100, 140, 180] }, [
        { stat: 'bonusAd', value: 0.9 },
        { stat: 'targetMissingHpFraction', value: { byRank: [60, 100, 140, 180] }, perStat: { stat: 'bonusAd', value: 0.9 } },
      ])],
    }],
  },
  w: {
    ...utility('lee-sin-w', 'Safeguard', 4, { byRank: [15, 14.5, 14, 13.5] }, 50),
    effects: [{
      kind: 'empoweredAttack', id: 'lee-sin-w-iron-will', name: 'Iron Will',
      description: 'Empowers next two attacks to deal an additional 26 (+40% AP) magic damage and gain 20% Omnivamp.',
      support: 'partial',
      supportNotes: 'The recast (Iron Will) is folded into the first cast: one W gives both empowered attacks. The '
        + 'shield, Omnivamp and the cooldown cut per attack are not modelled. 3 s to use them is assumed.',
      grant: { on: 'abilityCast', slots: ['w'], charges: 2 }, maxCharges: 2, durationSeconds: 3,
      bonus: magic({ byRank: [26, 39, 52, 65] }, [{ stat: 'ap', value: 0.4 }]),
    }],
  },
  e: {
    id: 'lee-sin-e', name: 'Tempest', maxRank: 4, cooldown: 8, cost: 50, castTime: 0, flags: {},
    // Cripple (the recast) only slows.
    damage: [magic({ byRank: [35, 70, 105, 140] }, [{ stat: 'totalAd', value: 0.9 }])],
  },
  r: {
    id: 'lee-sin-r', name: "Dragon's Rage", maxRank: 3, cooldown: { byRank: [70, 60, 50] }, castTime: 0, flags: {},
    damage: [physical({ byRank: [125, 350, 575] }, [
      { stat: 'bonusAd', value: 1.9 }, { stat: 'bonusHp', value: { byRank: [0.12, 0.15, 0.18] } },
    ])],
  },
})

// Hwei has nine spells: each of Q, W and E opens a subject, and a second press (Q, W or E) picks the spell. Each
// subject is an ability with three variants; a combo casts one as e.g. QW (Severing Bolt). A plain Q, W or E casts
// the first variant listed, the subject's usual damage spell.
const HWEI_E_DAMAGE = () => [magic({ byRank: [70, 120, 170, 220] }, [{ stat: 'ap', value: 0.7 }])]

const HWEI = modelled('hwei', {
  passive: {
    id: 'hwei-passive', name: 'SIGNATURE OF THE VISIONARY', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'procEveryN', id: 'hwei-passive-signature', name: 'Signature of the Visionary',
      description: 'Hitting a marked enemy with a second damaging ability consumes the mark to create an explosion, '
        + 'dealing 40–285 (based on level) (+30% AP) magic damage.',
      support: 'partial',
      supportNotes: 'Every second ability hit explodes, at once (the short delay, the 4 s mark and "each ability once" '
        + 'are not modelled). Values between levels 1 and 15 assume a straight line.',
      condition: { type: 'sourceKind', value: 'ability' },
      n: 2, damageType: 'magic', damage: byLevelLine(40, 285), ratios: [{ stat: 'ap', value: 0.3 }], resetsOnMiss: false,
    }],
  },
  q: {
    id: 'hwei-q', name: 'SUBJECT: DISASTER', maxRank: 4, cooldown: { byRank: [9.5, 8.5, 7.5, 6.5] },
    cost: { byRank: [80, 90, 100, 110] }, castTime: 0, damage: [], flags: {},
    variants: [
      {
        id: 'hwei-q-devastating-fire', key: 'q', name: 'Devastating Fire',
        damage: [magic({ byRank: [50, 85, 120, 155] }, [
          { stat: 'ap', value: 0.7 }, { stat: 'targetMaxHp', value: { byRank: [0.04, 0.05, 0.06, 0.07] } },
        ])],
      },
      {
        // One target (the 1v1 case), so the missing-Health bonus applies: up to 200/330/490/680 (+75% AP), taken
        // as rising in a straight line to its full value at no Health. The bolt's delay is not timed.
        id: 'hwei-q-severing-bolt', key: 'w', name: 'Severing Bolt',
        damage: [magic({ byRank: [80, 110, 140, 170] }, [
          { stat: 'ap', value: 0.3 },
          { stat: 'targetMissingHpFraction', value: { byRank: [200, 330, 490, 680] }, perStat: { stat: 'ap', value: 0.75 } },
        ])],
      },
      {
        // One eruption hits the target; the lava burn is the effect below.
        id: 'hwei-q-molten-fissure', key: 'e', name: 'Molten Fissure',
        damage: [magic({ byRank: [20, 35, 50, 65] }, [{ stat: 'ap', value: 0.3 }])],
      },
    ],
    effects: [{
      kind: 'dot', id: 'hwei-q-molten-fissure-lava', name: 'Molten Fissure (lava)',
      description: 'Enemies in the lava area are dealt 20 (+30% AP) magic damage per second. Each lava pool lasts 2.5 '
        + 'seconds.',
      support: 'partial',
      supportNotes: 'The target is assumed to stand in the lava for all 2.5 seconds (ticks every 0.5 s). The slow is '
        + 'not modelled.',
      condition: { type: 'abilityVariant', value: 'e' },
      damageType: 'magic', tickAmount: { byRank: [10, 20, 30, 40] }, tickIntervalSeconds: 0.5, durationSeconds: 2.5,
      refresh: 'refresh', appliedBy: ['q'], ratios: [{ stat: 'ap', value: 0.15 }],
    }],
  },
  w: {
    id: 'hwei-w', name: 'SUBJECT: SERENITY', maxRank: 4, cooldown: { byRank: [17, 16.5, 16, 15.5] },
    cost: { byRank: [90, 95, 100, 105] }, castTime: 0, damage: [], flags: {},
    // Stirring Lights is listed first, so a plain W casts it. Fleeting Current (speed) and Pool of Reflection (a
    // shield) deal no damage.
    variants: [
      { id: 'hwei-w-stirring-lights', key: 'e', name: 'Stirring Lights', damage: [] },
      { id: 'hwei-w-fleeting-current', key: 'q', name: 'Fleeting Current', damage: [] },
      { id: 'hwei-w-pool-of-reflection', key: 'w', name: 'Pool of Reflection', damage: [] },
    ],
    effects: [{
      kind: 'empoweredAttack', id: 'hwei-w-stirring-lights-empower', name: 'Stirring Lights',
      description: 'His next 3 abilities or attacks deal 30 (+15% AP) bonus magic damage and restore 45 Mana on hit.',
      support: 'partial',
      supportNotes: 'Only attacks spend the lights; abilities do not yet. How long they last is not stated (6 s '
        + 'assumed). Mana is not modelled.',
      condition: { type: 'abilityVariant', value: 'e' },
      grant: { on: 'abilityCast', slots: ['w'], charges: 3 }, maxCharges: 3, durationSeconds: 6,
      bonus: magic({ byRank: [30, 40, 50, 60] }, [{ stat: 'ap', value: 0.15 }]),
    }],
  },
  e: {
    // All three deal the same damage; they differ in crowd control (fear, root, pull), which isn't modelled.
    id: 'hwei-e', name: 'SUBJECT: TORMENT', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] },
    cost: { byRank: [50, 55, 60, 65] }, castTime: 0, damage: [], flags: {},
    variants: [
      { id: 'hwei-e-grim-visage', key: 'q', name: 'Grim Visage', damage: HWEI_E_DAMAGE() },
      { id: 'hwei-e-gaze-of-the-abyss', key: 'w', name: 'Gaze of the Abyss', damage: HWEI_E_DAMAGE() },
      { id: 'hwei-e-crushing-maw', key: 'e', name: 'Crushing Maw', damage: HWEI_E_DAMAGE() },
    ],
  },
  r: {
    id: 'hwei-r', name: 'SPIRALING DESPAIR', maxRank: 3, cooldown: { byRank: [70, 60, 50] }, cost: 100, castTime: 0, flags: {},
    // The shatter. It lands when the vision reaches full size (~3 s); the model deals it on cast.
    damage: [magic({ byRank: [200, 300, 400] }, [{ stat: 'ap', value: 0.7 }])],
    effects: [{
      kind: 'dot', id: 'hwei-r-spiraling-despair', name: 'Spiraling Despair',
      description: 'The vision sticks to an enemy champion for 3 seconds, dealing 10 (+5% AP) magic damage per second.',
      support: 'partial', supportNotes: 'The stacking slow is not modelled.',
      damageType: 'magic', tickAmount: { byRank: [10, 20, 30] }, tickIntervalSeconds: 1, durationSeconds: 3,
      refresh: 'refresh', appliedBy: ['r'], ratios: [{ stat: 'ap', value: 0.05 }],
    }],
  },
})

const HEADSHOT_READY = 'caitlyn-headshot-ready'
const HEADSHOT_RATIO = [{ stat: 'totalAd' as const, value: 0.6 }]

const CAITLYN = modelled('caitlyn', {
  passive: {
    id: 'caitlyn-passive', name: 'HEADSHOT', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'procEveryN', id: 'caitlyn-passive-headshot', name: 'Headshot',
        description: "Every 6 attacks, Caitlyn's next attack fires a Headshot that deals 60% AD bonus physical damage.",
        support: 'partial',
        supportNotes: "Read literally, so the 7th attack is the Headshot (unverified). Headshot's scaling with crit and "
          + 'the faster build-up in brush are not modelled.',
        inputs: [{ type: 'boolean', id: HEADSHOT_READY, label: 'Caitlyn: Headshot ready at combo start', default: false }],
        n: 7, countsFrom: 'basicAttack', damageType: 'physical', damage: 0, ratios: [{ stat: 'ad', value: 0.6 }],
        startReadyInputId: HEADSHOT_READY, resetsOnMiss: false,
      },
      {
        kind: 'empoweredAttack', id: 'caitlyn-passive-trap-net-headshot', name: 'Headshot (trapped or netted)',
        description: 'Attacks against trapped or netted targets fire a Headshot with double range.',
        support: 'partial',
        supportNotes: 'Granted when W or E is cast (the model assumes the trap or net hits) and spent by the next '
          + 'attack within 1.5 s (assumed).',
        grant: { on: 'abilityCast', slots: ['w', 'e'] }, maxCharges: 1, durationSeconds: 1.5,
        bonus: physical(0, HEADSHOT_RATIO),
      },
    ],
  },
  q: {
    id: 'caitlyn-q', name: 'PILTOVER PEACEMAKER', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] },
    cost: { byRank: [50, 60, 70, 80] }, castTime: 0, flags: {},
    // The first enemy hit takes full damage.
    damage: [physical({ byRank: [50, 100, 150, 200] }, [{ stat: 'totalAd', value: { byRank: [1.25, 1.45, 1.65, 1.85] } }])],
  },
  w: {
    // Traps recharge instead of having a cooldown; the recharge time stands in for the cooldown.
    ...utility('caitlyn-w', 'YORDLE SNAP TRAP', 4, { byRank: [25, 20, 15, 10] }, 20),
    effects: [{
      kind: 'empoweredAttack', id: 'caitlyn-w-trap-headshot', name: 'Yordle Snap Trap (Headshot)',
      description: 'Targets rooted by this ability take an additional 40 (+30% bonus AD) physical damage from Headshot.',
      support: 'partial', supportNotes: 'Assumes the target steps on the trap as it is cast.',
      grant: { on: 'abilityCast', slots: ['w'] }, maxCharges: 1, durationSeconds: 1.5,
      bonus: physical({ byRank: [40, 90, 140, 190] }, [{ stat: 'bonusAd', value: 0.3 }]),
    }],
  },
  e: {
    id: 'caitlyn-e', name: '90 CALIBER NET', maxRank: 4, cooldown: { byRank: [16, 14, 12, 10] }, cost: 75, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 120, 170, 220] }, [{ stat: 'ap', value: 0.8 }])],
  },
  r: {
    id: 'caitlyn-r', name: 'ACE IN THE HOLE', maxRank: 3, cooldown: { byRank: [65, 55, 45] }, cost: 100,
    // League's 1 s channel. Scaling with crit at 30% effectiveness is not modelled.
    castTime: 1, flags: {},
    damage: [physical({ byRank: [250, 450, 650] }, [{ stat: 'bonusAd', value: 1 }, { stat: 'targetMissingHp', value: 0.2 }])],
  },
})

const MIST_STACKS = 'senna-mist-stacks'

const SENNA = modelled('senna', {
  passive: {
    id: 'senna-passive', name: 'ABSOLUTION', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'onHit', id: 'senna-passive-relic-cannon', name: 'Relic Cannon',
        description: 'Attacks deal 10 bonus physical damage.',
        support: 'partial',
        supportNotes: "Living Extraction (1% of current Health), the slower attack wind-up and Senna's 90% critical "
          + 'damage are not modelled.',
        damageType: 'physical', flat: 10,
      },
      {
        kind: 'stacking', id: 'senna-passive-mist-ad', name: 'Mist (Attack Damage)',
        description: 'Gains 1.25 Attack Damage per stack of Mist.',
        support: 'full',
        inputs: [{ type: 'stackCount', id: MIST_STACKS, label: 'Senna: Mist stacks', min: 0, max: 500, default: 0 }],
        stat: 'ad', perStack: 1.25, maxStacks: 500, stackInputId: MIST_STACKS,
      },
      {
        kind: 'stacking', id: 'senna-passive-mist-crit', name: 'Mist (Critical Strike Chance)',
        description: 'Gains 10% Critical Strike Chance per 20 stacks.',
        support: 'partial',
        supportNotes: 'Spread evenly (0.5% per stack) instead of 10% at each 20. The range and the conversion of '
          + 'excess crit to Physical Vamp are not modelled.',
        stat: 'critChance', perStack: 0.005, maxStacks: 500, stackInputId: MIST_STACKS,
      },
    ],
  },
  q: {
    id: 'senna-q', name: 'PIERCING DARKNESS', maxRank: 4, cooldown: 15, cost: { byRank: [70, 80, 90, 100] }, castTime: 0,
    // Applies on-hit effects to champions (not yet modelled for abilities); attacks cutting its cooldown isn't modelled.
    flags: { appliesOnHit: true },
    damage: [physical({ byRank: [50, 80, 110, 140] }, [{ stat: 'bonusAd', value: 0.6 }])],
  },
  w: {
    id: 'senna-w', name: 'LAST EMBRACE', maxRank: 4, cooldown: 11, cost: { byRank: [55, 60, 65, 70] }, castTime: 0, flags: {},
    damage: [physical({ byRank: [90, 155, 220, 285] }, [{ stat: 'bonusAd', value: 0.7 }])],
  },
  e: utility('senna-e', 'CURSE OF THE BLACK MIST', 4, { byRank: [22, 20, 18, 16] }, 70),
  r: {
    id: 'senna-r', name: 'DAWNING SHADOW', maxRank: 3, cooldown: { byRank: [85, 80, 75] }, cost: 100,
    // League's 1 s wind-up.
    castTime: 1, flags: {},
    damage: [physical({ byRank: [250, 400, 550] }, [{ stat: 'bonusAd', value: 1.2 }, { stat: 'ap', value: 0.7 }])],
  },
})

/** Kits first hand-modelled on 7.3a: the most-picked champion in each lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_7_3A: Champion[] = [
  DARIUS, LEE_SIN, HWEI, CAITLYN, SENNA, ...HAND_MODELED_CHAMPIONS_BATCH2, ...HAND_MODELED_CHAMPIONS_BATCH3,
  ...HAND_MODELED_CHAMPIONS_BATCH4,
  ...HAND_MODELED_CHAMPIONS_BATCH5,
  ...HAND_MODELED_CHAMPIONS_BATCH6,
  ...HAND_MODELED_CHAMPIONS_BATCH7,
  ...HAND_MODELED_CHAMPIONS_BATCH8,
  ...HAND_MODELED_CHAMPIONS_BATCH9,
  ...HAND_MODELED_CHAMPIONS_BATCH10,
  ...HAND_MODELED_CHAMPIONS_BATCH11,
  ...HAND_MODELED_CHAMPIONS_BATCH12,
  ...HAND_MODELED_CHAMPIONS_BATCH13,
  ...HAND_MODELED_CHAMPIONS_BATCH14,
  ...HAND_MODELED_CHAMPIONS_BATCH15,
]
