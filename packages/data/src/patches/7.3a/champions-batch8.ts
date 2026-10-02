import type { Champion, DamageComponent } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 8 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Aatrox (Baron), Nocturne (Jungle), Yone (Mid), Jhin (Dragon) and Malphite (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const AATROX_WORLD_ENDER = 'aatrox-world-ender-active'

/** Yone's "physical and magic damage", read as half of each: the physical half and an identical magic half. */
const physicalAndMagic = (half: DamageComponent): DamageComponent[] => [half, { ...half, type: 'magic' }]

const AATROX_Q_CAST = (multiplier: number): DamageComponent => physical(
  { byRank: [10, 40, 70, 100].map((value) => value * multiplier) },
  [{ stat: 'totalAd', value: { byRank: [0.75, 0.8, 0.85, 0.9].map((value) => value * multiplier) } }],
)

const AATROX = modelled('aatrox', {
  passive: {
    id: 'aatrox-passive', name: 'Deathbringer Stance', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'aatrox-passive-deathbringer-stance', name: 'Deathbringer Stance',
      description: "Enhances his next attack every 24 seconds to deal bonus physical damage equal to 4% (based on level) "
        + "of the target's max Health. Hitting a champion with an attack or ability reduces the cooldown by 3 seconds.",
      support: 'partial',
      supportNotes: "4% at every level (the level scaling isn't stated). The 3 second refund per hit and the heal are "
        + 'not modelled, so it procs less often here than in game.',
      triggeredBy: ['basicAttack'], damageType: 'physical', damage: 0, ratios: [], pctTargetMaxHp: 0.04, cooldownSeconds: 24,
    }],
  },
  q: {
    id: 'aatrox-q', name: 'The Darkin Blade', maxRank: 4, cooldown: { byRank: [12, 10, 8, 6] }, castTime: 0, flags: {},
    // All three casts at once, each 25% stronger than the last (1x, 1.25x, 1.5x), none on the sweetspot (+60%).
    damage: [AATROX_Q_CAST(1), AATROX_Q_CAST(1.25), AATROX_Q_CAST(1.5)],
  },
  w: {
    id: 'aatrox-w', name: 'Infernal Chains', maxRank: 4, cooldown: { byRank: [15, 14, 13, 12] }, castTime: 0, flags: {},
    // The second hit needs the target to stay in the area for 1.5 seconds; it isn't modelled.
    damage: [physical({ byRank: [25, 40, 55, 70] }, [{ stat: 'totalAd', value: 0.4 }])],
  },
  // Umbral Dash is a dash and physical vamp.
  e: utility('aatrox-e', 'Umbral Dash', 4, { byRank: [8, 7, 6, 5] }),
  r: {
    ...utility('aatrox-r', 'World Ender', 3, { byRank: [75, 65, 55] }),
    effects: [{
      kind: 'statMultiplier', id: 'aatrox-r-world-ender', name: 'World Ender',
      description: 'For 10 seconds, gains 30/40/50% Attack Damage.',
      support: 'partial',
      supportNotes: 'A toggle says whether it is active for the whole combo; casting R does not switch it on.',
      inputs: [{ type: 'boolean', id: AATROX_WORLD_ENDER, label: 'Aatrox: World Ender active', default: false }],
      condition: { type: 'toggle', inputId: AATROX_WORLD_ENDER },
      stat: 'ad', layer: 'total', amount: { byRank: [0.3, 0.4, 0.5] },
    }],
  },
})

const NOCTURNE = modelled('nocturne', {
  passive: {
    id: 'nocturne-passive', name: 'Umbra Blades', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'procEveryN', id: 'nocturne-passive-umbra-blades', name: 'Umbra Blades',
      description: "Every 12 seconds, Nocturne's next attack strikes for 120% AD physical damage. Attacks against "
        + 'champions reduce the cooldown by 3 seconds.',
      support: 'partial',
      supportNotes: 'Read as every 4th attack (12 seconds / 3 per attack against a champion), adding 20% AD to it. '
        + 'The first one in a combo comes at the 4th attack, not the 1st. The heal is not modelled.',
      n: 4, countsFrom: 'basicAttack', damageType: 'physical', damage: 0, ratios: [{ stat: 'ad', value: 0.2 }], resetsOnMiss: false,
    }],
  },
  q: {
    id: 'nocturne-q', name: 'Duskbringer', maxRank: 4, cooldown: 7, cost: { byRank: [60, 65, 70, 75] }, castTime: 0, flags: {},
    damage: [physical({ byRank: [70, 125, 180, 235] }, [{ stat: 'bonusAd', value: 0.85 }])],
    effects: [{
      kind: 'castBuff', id: 'nocturne-q-dusk-trail', name: 'Dusk Trail',
      description: 'Gains 20 Attack Damage on Dusk Trails (which last 5 seconds).',
      support: 'partial', supportNotes: 'He is assumed to stay on the trail for all 5 seconds.',
      slots: ['q'], stat: 'ad', amount: { byRank: [20, 30, 40, 50] }, durationSeconds: 5, cooldownSeconds: 0,
    }],
  },
  w: {
    ...utility('nocturne-w', 'Shroud of Darkness', 4, { byRank: [18, 16, 14, 12] }, 50),
    effects: [{
      kind: 'stat', id: 'nocturne-w-passive', name: 'Shroud of Darkness (passive)', description: 'Gains 35% Attack Speed.',
      support: 'partial', supportNotes: 'The doubled attack speed after blocking an ability is not modelled.',
      stat: 'attackSpeed', amount: { byRank: [0.35, 0.4, 0.45, 0.5] },
    }],
  },
  e: {
    id: 'nocturne-e', name: 'Unspeakable Horror', maxRank: 4, cooldown: { byRank: [14, 13, 12, 11] },
    cost: { byRank: [60, 65, 70, 75] }, castTime: 0, flags: {},
    // Its 2 seconds of damage land at once.
    damage: [magic({ byRank: [80, 140, 200, 260] }, [{ stat: 'ap', value: 1 }])],
  },
  r: {
    id: 'nocturne-r', name: 'Paranoia', maxRank: 3, cooldown: { byRank: [110, 90, 70] }, cost: 100, castTime: 0, flags: {},
    // The recast's launch, folded into the cast.
    damage: [physical({ byRank: [150, 275, 400] }, [{ stat: 'bonusAd', value: 1.2 }])],
  },
})

const YONE = modelled('yone', {
  passive: {
    id: 'yone-passive', name: 'Way of the Hunter', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'statMultiplier', id: 'yone-passive-intent', name: 'Intent',
      description: "Yone's Critical Rate is doubled, but his Critical Strikes deal only 90% critical damage.",
      support: 'partial',
      supportNotes: 'Only the doubling is modelled (as for Yasuo). Every other attack dealing half its damage as magic '
        + '(Steel and Spirit), the 90% critical damage and crit above 100% turning into AD are not.',
      stat: 'critChance', layer: 'bonus', amount: 1,
    }],
  },
  q: {
    id: 'yone-q', name: 'Mortal Steel', maxRank: 4, cooldown: 3.8, castTime: 0, flags: {},
    // Treated as an attack in game (crits, on-hit effects, cooldown cut by attack speed); none of that is modelled.
    damage: [physical({ byRank: [30, 50, 70, 90] }, [{ stat: 'totalAd', value: 1 }])],
  },
  w: {
    id: 'yone-w', name: 'Spirit Cleave', maxRank: 4, cooldown: 13.4, castTime: 0, flags: {},
    // "Physical and magic damage" read as half of each. The shield and attack speed cutting the cooldown aren't modelled.
    damage: physicalAndMagic(physical({ byRank: [10, 17.5, 25, 32.5] }, [
      { stat: 'targetMaxHp', value: { byRank: [0.045, 0.05, 0.055, 0.06] } },
    ])),
  },
  // Soul Unbound repeats 27.5-35% of the damage dealt during Spirit Form as true damage; not modelled (no hook
  // records damage dealt over a window).
  e: utility('yone-e', 'Soul Unbound', 4, { byRank: [20, 17, 14, 11] }),
  r: {
    id: 'yone-r', name: 'Fate Sealed', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, castTime: 0, flags: {},
    damage: physicalAndMagic(physical({ byRank: [100, 187.5, 275] }, [{ stat: 'totalAd', value: 0.3 }])),
  },
})

const JHIN = modelled('jhin', {
  passive: {
    id: 'jhin-passive', name: 'Whisper', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'procEveryN', id: 'jhin-passive-fourth-shot', name: 'Whisper (4th shot)',
      description: 'Whisper carries 4 shots. Crits deal only 80% critical damage. The final bullet critically strikes '
        + "and deals an additional 11% of the target's missing Health as physical damage.",
      support: 'partial',
      supportNotes: 'The 4th shot adds 60% AD (a crit at 160%). Its 11% missing Health, the fixed attack rate, the '
        + 'reload, and bonus attack speed turning into AD are not modelled: attack speed still speeds Jhin up here.',
      n: 4, countsFrom: 'basicAttack', damageType: 'physical', damage: 0, ratios: [{ stat: 'ad', value: 0.6 }], resetsOnMiss: false,
    }],
  },
  q: {
    id: 'jhin-q', name: 'Dancing Grenade', maxRank: 4, cooldown: { byRank: [6.5, 6, 5.5, 5] }, cost: { byRank: [45, 50, 55, 60] },
    castTime: 0, flags: {},
    damage: [physical({ byRank: [45, 80, 115, 150] }, [
      { stat: 'totalAd', value: { byRank: [0.35, 0.45, 0.55, 0.65] } }, { stat: 'ap', value: 0.6 },
    ])],
  },
  w: {
    id: 'jhin-w', name: 'Deadly Flourish', maxRank: 4, cooldown: 12, cost: { byRank: [60, 65, 70, 75] }, castTime: 0, flags: {},
    damage: [physical({ byRank: [60, 100, 140, 180] }, [{ stat: 'totalAd', value: 0.4 }])],
  },
  e: {
    id: 'jhin-e', name: 'Captive Audience', maxRank: 4, cooldown: 2, cost: { byRank: [35, 40, 45, 50] }, castTime: 0, flags: {},
    // One trap per cast; the recharge time between traps (20-14s) is not modelled.
    damage: [magic({ byRank: [20, 100, 180, 260] }, [{ stat: 'totalAd', value: 1.2 }, { stat: 'ap', value: 1 }])],
  },
  r: {
    id: 'jhin-r', name: 'Curtain Call', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // All 4 shots land at once: 3 normal plus a 200% crit = 5x. The +3% per 1% missing Health is applied to the base
    // only (AD part left out), as a straight line.
    damage: [{
      ...physical({ byRank: [75, 150, 225] }, [
        { stat: 'totalAd', value: 0.25 },
        { stat: 'targetMissingHpFraction', value: { byRank: [75 * 3, 150 * 3, 225 * 3] } },
      ]),
      hits: 5,
    }],
  },
})

const MALPHITE = modelled('malphite', {
  // Granite Shield is a shield.
  passive: utility('malphite-passive', 'Granite Shield', 1, null),
  q: {
    id: 'malphite-q', name: 'Seismic Shard', maxRank: 4, cooldown: 8, cost: { byRank: [75, 80, 85, 90] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 130, 190, 250] }, [{ stat: 'ap', value: 0.45 }])],
  },
  w: {
    ...utility('malphite-w', 'Thunderclap', 4, { byRank: [10, 9, 8, 7] }, 25),
    effects: [
      {
        kind: 'statMultiplier', id: 'malphite-w-passive', name: 'Thunderclap (passive)', description: 'Gains 25% Armor.',
        support: 'partial', supportNotes: 'The text also says "10 Armor"; only the percentage from the table is used.',
        stat: 'armor', layer: 'total', amount: { byRank: [0.25, 0.3, 0.35, 0.4] },
      },
      {
        kind: 'empoweredAttack', id: 'malphite-w-first-attack', name: 'Thunderclap (first attack)',
        description: 'The first attack is empowered to deal 40 (+40% AP +40% Armor) bonus physical damage.',
        support: 'full',
        grant: { on: 'abilityCast', slots: ['w'], charges: 1 }, maxCharges: 1, durationSeconds: 6,
        bonus: physical({ byRank: [40, 60, 80, 100] }, [{ stat: 'ap', value: 0.4 }, { stat: 'armor', value: 0.4 }]),
      },
      {
        kind: 'empoweredAttack', id: 'malphite-w-cone', name: 'Thunderclap (cone)',
        description: 'For the next 6 seconds, attacks deal 20 (+20% AP +15% Armor) physical damage in a cone.',
        support: 'partial', supportNotes: 'The target is assumed to be in every cone.',
        grant: { on: 'abilityCast', slots: ['w'], charges: 99 }, maxCharges: 99, durationSeconds: 6,
        bonus: physical({ byRank: [20, 30, 40, 50] }, [{ stat: 'ap', value: 0.2 }, { stat: 'armor', value: 0.15 }]),
      },
    ],
  },
  e: {
    id: 'malphite-e', name: 'Ground Slam', maxRank: 4, cooldown: 7, cost: { byRank: [55, 60, 65, 70] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 110, 160, 210] }, [{ stat: 'ap', value: 0.45 }, { stat: 'armor', value: 0.4 }])],
  },
  r: {
    id: 'malphite-r', name: 'Unstoppable Force', maxRank: 3, cooldown: { byRank: [85, 80, 75] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [200, 300, 400] }, [{ stat: 'ap', value: 0.9 }])],
  },
})

/** The eighth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH8: Champion[] = [AATROX, NOCTURNE, YONE, JHIN, MALPHITE]
