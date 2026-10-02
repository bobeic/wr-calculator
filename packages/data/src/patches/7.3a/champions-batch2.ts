import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 2 (2026-10-03): the second most-picked champion in each lane on the CN server (all ranks, 2026-09-30):
// Cho'Gath (Baron), Master Yi (Jungle), Yasuo (Mid), Miss Fortune (Dragon) and Nautilus (Support). Same approach as
// champions.ts: wrpocket's 7.3a text, one-on-one damage dealt, nothing checked in game yet.

/** "Lasts while ..." effects (a 5 s buff, a shield) empower every attack in the window: enough charges never to run out. */
const EVERY_ATTACK = 99

const FEAST_STACKS = 'chogath-feast-stacks'

const CHOGATH = modelled('chogath', {
  // Carnivore restores Health and Mana on kills; nothing to model one-on-one.
  passive: utility('chogath-passive', 'CARNIVORE', 1, null),
  q: {
    id: 'chogath-q', name: 'RUPTURE', maxRank: 4, cooldown: 6, cost: 60, castTime: 0, flags: {},
    // The rupture's delay before it erupts is not timed.
    damage: [magic({ byRank: [80, 135, 190, 245] }, [{ stat: 'ap', value: 1 }])],
  },
  w: {
    id: 'chogath-w', name: 'FERAL SCREAM', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] },
    cost: { byRank: [70, 80, 90, 100] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 130, 180, 230] }, [{ stat: 'ap', value: 0.7 }])],
  },
  e: {
    ...utility('chogath-e', 'VORPAL SPIKES', 4, { byRank: [7, 6, 5, 4] }, 30),
    effects: [{
      kind: 'empoweredAttack', id: 'chogath-e-vorpal-spikes', name: 'Vorpal Spikes',
      description: "Cho'Gath's next 3 attacks launch spikes that deal 20 (+30% AP) magic damage plus magic damage equal "
        + "to (2.3% +0.6% × Feast stacks) of the target's max Health.",
      support: 'partial',
      supportNotes: 'How long the spikes last is not stated (5 s assumed). The slow is not modelled.',
      grant: { on: 'abilityCast', slots: ['e'], charges: 3 }, maxCharges: 3, durationSeconds: 5,
      bonus: magic({ byRank: [20, 45, 70, 95] }, [
        { stat: 'ap', value: 0.3 },
        { stat: 'targetMaxHp', value: { byRank: [0.023, 0.027, 0.031, 0.035] }, perInput: { inputId: FEAST_STACKS, value: 0.006 } },
      ]),
    }],
  },
  r: {
    id: 'chogath-r', name: 'FEAST', maxRank: 3, cooldown: { byRank: [70, 60, 50] }, cost: 100, castTime: 0, flags: {},
    damage: [{
      type: 'true', base: { byRank: [300, 450, 600] },
      ratios: [{ stat: 'ap', value: 0.5 }, { stat: 'bonusHp', value: 0.1 }], tags: [],
    }],
    effects: [{
      kind: 'stacking', id: 'chogath-r-feast', name: 'Feast',
      description: 'Each Feast stack grants 80 max Health.',
      support: 'partial',
      supportNotes: "Every stack counts at R's current rank (80/120/160); in game each keeps the rank it was gained at. "
        + 'Size and range are not modelled.',
      inputs: [{ type: 'stackCount', id: FEAST_STACKS, label: "Cho'Gath: Feast stacks", min: 0, max: 50, default: 0 }],
      stat: 'hp', perStack: { byRank: [80, 120, 160] }, maxStacks: 50, stackInputId: FEAST_STACKS,
    }],
  },
})

const MASTER_YI = modelled('master-yi', {
  passive: {
    id: 'master-yi-passive', name: 'Double Strike', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'procEveryN', id: 'master-yi-passive-double-strike', name: 'Double Strike',
      description: 'Every 4th consecutive attack strikes twice for 150% AD physical damage.',
      support: 'partial',
      supportNotes: 'Read as the attack (100%) plus a second strike of 50% AD. Whether the second strike crits or '
        + 'applies on-hit effects is not modelled.',
      n: 4, countsFrom: 'basicAttack', damageType: 'physical', damage: 0, ratios: [{ stat: 'ad', value: 0.5 }],
      resetsOnMiss: false,
    }],
  },
  q: {
    id: 'master-yi-q', name: 'Alpha Strike', maxRank: 4, cooldown: { byRank: [17, 16, 15, 14] },
    cost: { byRank: [55, 60, 65, 70] }, castTime: 0, flags: {},
    // One target: the first strike, then the other three strikes return to it for 25% each (1.75× in all). Crits
    // and the cooldown cut per attack are not modelled.
    damage: [
      physical({ byRank: [20, 60, 100, 140] }, [{ stat: 'totalAd', value: 0.6 }]),
      { ...physical({ byRank: [5, 15, 25, 35] }, [{ stat: 'totalAd', value: 0.15 }]), hits: 3 },
    ],
  },
  w: utility('master-yi-w', 'Meditate', 4, 25, 50),
  e: {
    ...utility('master-yi-e', 'Wuju Style', 4, { byRank: [17, 16, 15, 14] }),
    effects: [
      {
        kind: 'stat', id: 'master-yi-e-passive-flat', name: 'Wuju Style (passive)',
        description: 'Gains 5 Attack Damage (8% AD) while Wuju Style is off cooldown.',
        support: 'partial',
        supportNotes: 'Read as 5 AD plus 8% AD (next effect), held all the time; losing it while E is on cooldown is '
          + 'not modelled.',
        stat: 'ad', amount: 5,
      },
      {
        kind: 'statMultiplier', id: 'master-yi-e-passive-pct', name: 'Wuju Style (passive, 8% AD)',
        description: 'Gains 5 Attack Damage (8% AD) while Wuju Style is off cooldown.',
        support: 'partial', supportNotes: 'See Wuju Style (passive).',
        stat: 'ad', layer: 'total', amount: 0.08,
      },
      {
        kind: 'empoweredAttack', id: 'master-yi-e-wuju-style', name: 'Wuju Style',
        description: 'Attacks deal 30 (+25% bonus AD) bonus true damage for 5 seconds.',
        support: 'full',
        grant: { on: 'abilityCast', slots: ['e'], charges: EVERY_ATTACK }, maxCharges: EVERY_ATTACK, durationSeconds: 5,
        bonus: { type: 'true', base: { byRank: [30, 35, 40, 45] }, ratios: [{ stat: 'bonusAd', value: 0.25 }], tags: [] },
      },
    ],
  },
  r: {
    ...utility('master-yi-r', 'Highlander', 3, { byRank: [70, 65, 60] }, 100),
    effects: [{
      kind: 'castBuff', id: 'master-yi-r-highlander', name: 'Highlander',
      description: 'Gains 35% Movement Speed and 30% Attack Speed for 7 seconds.',
      support: 'partial', supportNotes: 'Movement speed, slow immunity and the extension on takedowns are not modelled.',
      slots: ['r'], stat: 'attackSpeed', amount: { byRank: [0.3, 0.6, 0.9] }, durationSeconds: 7, cooldownSeconds: 0,
    }],
  },
})

const YASUO = modelled('yasuo', {
  passive: {
    id: 'yasuo-passive', name: 'Way of the Wanderer', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'statMultiplier', id: 'yasuo-passive-intent', name: 'Intent',
      description: "Yasuo's Critical Rate is doubled, but his Critical Strikes deal 90% critical damage.",
      support: 'partial',
      supportNotes: 'Only the doubling is modelled. The 90% critical damage, crit above 100% turning into AD (0.5 AD '
        + 'per 1%) and the Flow shield are not.',
      stat: 'critChance', layer: 'bonus', amount: 1,
    }],
  },
  q: {
    id: 'yasuo-q', name: 'Steel Tempest', maxRank: 4, cooldown: 4, castTime: 0, flags: {},
    // Treated as an attack in game (it can crit and applies on-hit effects); neither is modelled. Attack speed
    // shortening its cooldown is not modelled either.
    damage: [physical({ byRank: [20, 50, 80, 110] }, [{ stat: 'totalAd', value: 1.05 }])],
  },
  w: utility('yasuo-w', 'Wind Wall', 4, { byRank: [22, 20, 18, 16] }),
  e: {
    // Sweeping Blade can't dash through the same enemy again for 7 seconds, so against one target it is once per 7 s.
    // The +25% per stacked dash needs other targets and is not modelled.
    id: 'yasuo-e', name: 'Sweeping Blade', maxRank: 4, cooldown: 7, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 80, 90, 100] }, [{ stat: 'bonusAd', value: 0.2 }, { stat: 'ap', value: 0.6 }])],
  },
  r: {
    // Needs an airborne target (Q's third cast). The 55% bonus armor pen on crits afterwards is not modelled.
    id: 'yasuo-r', name: 'Last Breath', maxRank: 3, cooldown: { byRank: [50, 40, 30] }, castTime: 0, flags: {},
    damage: [physical({ byRank: [200, 350, 500] }, [{ stat: 'bonusAd', value: 1.5 }])],
  },
})

const MISS_FORTUNE = modelled('miss-fortune', {
  passive: {
    id: 'miss-fortune-passive', name: 'Love Tap', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'procEveryN', id: 'miss-fortune-passive-love-tap', name: 'Love Tap',
      description: 'At 3 stacks, deals 15 (+40% bonus AD) × (60% +0% Critical Rate) physical damage to the target.',
      support: 'partial',
      supportNotes: 'Taken as 60% of 15 (+40% bonus AD) on every third attack. Her 6% (based on level) extra damage '
        + 'to the target is not modelled.',
      n: 3, countsFrom: 'basicAttack', damageType: 'physical', damage: 9,
      ratios: [{ stat: 'ad', layer: 'bonus', value: 0.24 }], resetsOnMiss: false,
    }],
  },
  q: {
    id: 'miss-fortune-q', name: 'Double Up', maxRank: 4, cooldown: { byRank: [6, 5, 4, 3] }, cost: 35, castTime: 0, flags: {},
    // The first hit; the bounce (a guaranteed crit) needs a second enemy behind the target.
    damage: [physical({ byRank: [60, 90, 120, 150] }, [{ stat: 'totalAd', value: 1.1 }, { stat: 'ap', value: 0.35 }])],
  },
  w: {
    ...utility('miss-fortune-w', 'Strut', 4, 12, 30),
    effects: [{
      kind: 'castBuff', id: 'miss-fortune-w-strut', name: 'Strut',
      description: 'Grants 45% Attack Speed for 4 seconds.',
      support: 'partial', supportNotes: 'Movement speed and the cooldown cut from Love Tap are not modelled.',
      slots: ['w'], stat: 'attackSpeed', amount: { byRank: [0.45, 0.6, 0.75, 0.9] }, durationSeconds: 4, cooldownSeconds: 0,
    }],
  },
  e: {
    ...utility('miss-fortune-e', 'Make It Rain', 4, { byRank: [14.5, 13, 11.5, 10] }, { byRank: [65, 70, 75, 80] }),
    effects: [{
      kind: 'dot', id: 'miss-fortune-e-make-it-rain', name: 'Make It Rain',
      description: 'Rains down bullets on an area for 2 seconds, dealing 15 (+10% AP) magic damage every 0.25 seconds.',
      support: 'partial', supportNotes: 'The target is assumed to stay in the area for all 2 seconds. The slow is not modelled.',
      damageType: 'magic', tickAmount: { byRank: [15, 20, 25, 30] }, tickIntervalSeconds: 0.25, durationSeconds: 2,
      refresh: 'refresh', appliedBy: ['e'], ratios: [{ stat: 'ap', value: { byRank: [0.1, 0.11, 0.12, 0.13] } }],
    }],
  },
  r: {
    ...utility('miss-fortune-r', 'Bullet Time', 3, { byRank: [70, 65, 60] }, 100),
    effects: [{
      kind: 'dot', id: 'miss-fortune-r-bullet-time', name: 'Bullet Time',
      description: 'Channels a 3 second barrage of bullets, with 12 waves that each deal 20 (+60% AD +20% AP) physical '
        + 'damage.',
      support: 'partial',
      supportNotes: 'Every wave hits, one every 0.25 s (12/14/16 waves take 3/3.5/4 s here). Crits are not modelled, '
        + 'and she keeps attacking during the channel unless the combo waits (R wait:3).',
      damageType: 'physical', tickAmount: { byRank: [20, 30, 40] }, tickIntervalSeconds: 0.25,
      durationSeconds: { byRank: [3, 3.5, 4] }, refresh: 'refresh', appliedBy: ['r'],
      ratios: [{ stat: 'ad', value: 0.6 }, { stat: 'ap', value: 0.2 }],
    }],
  },
})

const NAUTILUS = modelled('nautilus', {
  passive: {
    id: 'nautilus-passive', name: 'STAGGERING BLOW', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'nautilus-passive-staggering-blow', name: 'Staggering Blow',
      description: 'Attacks deal an additional 13 (based on level) physical damage and root the target. 6 seconds '
        + 'cooldown on the same target.',
      support: 'partial',
      supportNotes: "Only the text's 13 is known, so it is 13 at every level. The root is not modelled.",
      triggeredBy: ['basicAttack'], damageType: 'physical', damage: 13, ratios: [], cooldownSeconds: 6,
    }],
  },
  q: {
    id: 'nautilus-q', name: 'DREDGE LINE', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [90, 150, 210, 270] }, [{ stat: 'ap', value: 0.75 }])],
  },
  w: {
    ...utility('nautilus-w', "TITAN'S WRATH", 4, 11, 80),
    effects: [{
      kind: 'empoweredAttack', id: 'nautilus-w-titans-wrath', name: "Titan's Wrath",
      description: "While the shield holds, Nautilus' attacks are empowered to deal an additional 50 (+40% AP) magic "
        + 'damage around the target.',
      support: 'partial', supportNotes: 'The shield is assumed to hold for all 6 seconds. The shield itself is not modelled.',
      grant: { on: 'abilityCast', slots: ['w'], charges: EVERY_ATTACK }, maxCharges: EVERY_ATTACK, durationSeconds: 6,
      bonus: magic({ byRank: [50, 60, 70, 80] }, [{ stat: 'ap', value: 0.4 }]),
    }],
  },
  e: {
    // One wave hits the target; whether later waves can hit it again (for 50%) is not modelled.
    id: 'nautilus-e', name: 'RIPTIDE', maxRank: 4, cooldown: { byRank: [6.5, 6, 5.5, 5] },
    cost: { byRank: [60, 70, 80, 90] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 110, 150, 190] }, [{ stat: 'ap', value: 0.5 }])],
  },
  r: {
    id: 'nautilus-r', name: 'DEPTH CHARGE', maxRank: 3, cooldown: { byRank: [70, 60, 50] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 275, 400] }, [{ stat: 'ap', value: 0.7 }])],
  },
})

/** The second most-picked champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH2: Champion[] = [CHOGATH, MASTER_YI, YASUO, MISS_FORTUNE, NAUTILUS]
