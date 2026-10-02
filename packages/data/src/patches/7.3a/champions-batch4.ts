import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 4 (2026-10-02): the fourth most-picked champion in each lane on the CN server (all ranks, 2026-09-30):
// Mordekaiser (Baron), Viego (Jungle), Veigar (Mid), Tristana (Dragon) and Leona (Support). Same approach as the
// earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const VEIGAR_STACKS = 'veigar-phenomenal-evil-stacks'

const MORDEKAISER = modelled('mordekaiser', {
  passive: {
    id: 'mordekaiser-passive', name: 'Darkness Rise', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'onHit', id: 'mordekaiser-passive-bonus-magic', name: 'Darkness Rise (on-hit)',
        description: 'Attacks deal 30% bonus magic damage.', support: 'full',
        damageType: 'magic', ratios: [{ stat: 'ad', value: 0.3 }],
      },
      {
        kind: 'hitStackProc', id: 'mordekaiser-passive-negative-energy', name: 'Negative Energy Field',
        description: 'At 3 stacks (1 per attack or ability hit, 5s window), cloaks in a field dealing 5 AP + 1% max '
          + "Health (both based on level) magic damage per second for 5 seconds.",
        support: 'partial',
        supportNotes: "Taken as flat 5% AP and 1% max Health (the level scaling isn't stated beyond \"based on "
          + 'level\"), same as other champions\' unstated level scaling. The 3% magic pen (also based on level) and '
          + 'the move speed are not modelled.',
        stacksToProc: 3, stackWindowSeconds: 5, cooldownSeconds: 0, stacksFrom: ['basicAttack', 'ability'],
        damage: { type: 'magic', base: 0, ratios: [{ stat: 'ap', value: 0.05 }, { stat: 'targetMaxHp', value: 0.01 }], tags: [] },
        delivery: { kind: 'dot', tickIntervalSeconds: 1, durationSeconds: 5 },
      },
    ],
  },
  q: {
    id: 'mordekaiser-q', name: 'Obliterate', maxRank: 4, cooldown: { byRank: [7, 6, 5, 4] }, castTime: 0, flags: {},
    // wrpocket's prose (80 + 4-70 by level, +70% AP +120% bonus AD) and its per-rank table (80-170 base, a
    // "Bonus AD Ratio" of 45-60%) don't reconcile cleanly; read as the table's base and the single-target +45-60%
    // bonus (every target in a 1v1 engine is "only one enemy hit"), baked into these byRank numbers. The small
    // level-based bonus from the prose is dropped.
    damage: [magic({ byRank: [116, 165, 217, 272] }, [
      { stat: 'ap', value: { byRank: [1.015, 1.05, 1.085, 1.12] } },
      { stat: 'bonusAd', value: { byRank: [1.74, 1.8, 1.86, 1.92] } },
    ])],
  },
  // Indestructible is a shield/heal; nothing to model one-on-one.
  w: utility('mordekaiser-w', 'Indestructible', 4, { byRank: [12, 11, 10, 9] }),
  e: {
    id: 'mordekaiser-e', name: "Death's Grasp", maxRank: 4, cooldown: { byRank: [15, 13, 11, 9] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 80, 100, 120] }, [{ stat: 'ap', value: 0.55 }])],
  },
  // Realm of Death steals stats; it deals no damage of its own.
  r: utility('mordekaiser-r', 'Realm of Death', 3, { byRank: [105, 90, 75] }),
})

const VIEGO = modelled('viego', {
  // Sovereign's Domination needs a kill to trigger; nothing to model one-on-one.
  passive: utility('viego-passive', "Sovereign's Domination", 1, null),
  q: {
    id: 'viego-q', name: 'Blade of the Ruined King', maxRank: 4, cooldown: { byRank: [4.5, 4, 3.5, 3] }, castTime: 0, flags: {},
    // Crit scaling at 60% effectiveness is not modelled.
    damage: [physical({ byRank: [25, 45, 65, 85] }, [{ stat: 'totalAd', value: 0.7 }])],
    effects: [
      {
        kind: 'onHit', id: 'viego-passive-current-hp', name: 'Blade of the Ruined King (on-hit)',
        description: "Attacks deal bonus physical damage equal to 3% of the target's current Health (minimum 10).",
        support: 'full', damageType: 'physical',
        pctTargetCurrentHp: { byRank: [0.03, 0.04, 0.05, 0.06] }, minDamage: { byRank: [10, 15, 20, 25] },
      },
      {
        kind: 'spellblade', id: 'viego-passive-double-strike', name: 'Double Strike',
        description: "After damaging an enemy with an ability, Viego's first attack against them within 5 seconds "
          + 'strikes twice. The second strike deals 15% AD (+15% AP) physical damage.',
        support: 'partial',
        supportNotes: 'Crit scaling and the 135% lifesteal on this strike are not modelled. No cooldown is stated '
          + 'beyond the 5 second window, so none is applied.',
        damageType: 'physical', bonusDamage: 0, internalCooldownSeconds: 0,
        ratios: [{ stat: 'ad', value: 0.15 }, { stat: 'ap', value: 0.15 }],
      },
    ],
  },
  w: {
    id: 'viego-w', name: 'Spectral Maw', maxRank: 4, cooldown: 7, castTime: 0, flags: {},
    // The stun scaling with charge time is not modelled.
    damage: [magic({ byRank: [80, 150, 220, 290] }, [{ stat: 'ap', value: 0.9 }])],
  },
  // Harrowed Path only buffs Viego while he stands in the mist it creates; too position-dependent to model.
  e: utility('viego-e', 'Harrowed Path', 4, { byRank: [12, 10, 8, 6] }),
  r: {
    id: 'viego-r', name: 'Heartbreaker', maxRank: 3, cooldown: { byRank: [90, 75, 60] }, castTime: 0, flags: {},
    // Crit scaling at 70% effectiveness and the knockback are not modelled.
    damage: [physical(0, [
      { stat: 'totalAd', value: 1.2 },
      { stat: 'targetMissingHp', value: { byRank: [0.14, 0.17, 0.2] }, perStat: { stat: 'bonusAd', value: 0.05 } },
    ])],
  },
})

const VEIGAR = modelled('veigar', {
  passive: {
    id: 'veigar-passive', name: 'Phenomenal Evil Power', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'stacking', id: 'veigar-passive-stacks', name: 'Phenomenal Evil Power',
      description: 'Landing an ability on a champion or killing a minion/monster with one grants 1 stack '
        + '(takedowns grant 7); each stack grants 1 Ability Power.',
      support: 'partial', supportNotes: 'Stacks are an input, not counted from casting.',
      inputs: [{ type: 'stackCount', id: VEIGAR_STACKS, label: 'Veigar: Phenomenal Evil Power stacks', min: 0, max: 200, default: 0 }],
      stat: 'ap', perStack: 1, maxStacks: 200, stackInputId: VEIGAR_STACKS,
    }],
  },
  q: {
    id: 'veigar-q', name: 'Baleful Strike', maxRank: 4, cooldown: { byRank: [5.5, 5, 4.5, 4] },
    cost: { byRank: [35, 40, 45, 50] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [65, 125, 185, 245] }, [{ stat: 'ap', value: { byRank: [0.55, 0.6, 0.65, 0.7] } }])],
  },
  w: {
    id: 'veigar-w', name: 'Dark Matter', maxRank: 4, cooldown: 8, cost: { byRank: [65, 70, 75, 80] }, castTime: 0, flags: {},
    // Cooldown reduction from stacks is not modelled.
    damage: [magic({ byRank: [100, 160, 220, 280] }, [{ stat: 'ap', value: 0.95 }])],
  },
  // Event Horizon is a stun cage; it deals no damage of its own.
  e: utility('veigar-e', 'Event Horizon', 4, { byRank: [18, 17, 16, 15] }, { byRank: [75, 80, 85, 90] }),
  r: {
    id: 'veigar-r', name: 'Primordial Burst', maxRank: 3, cooldown: { byRank: [60, 55, 50] }, cost: 100, castTime: 0, flags: {},
    // The 0-100% amp against low-Health targets isn't modelled: no ability-level hook scales a plain damage
    // component by missing Health (only procEveryN's targetMissingHpAmp does that).
    damage: [magic({ byRank: [185, 250, 315] }, [{ stat: 'ap', value: 0.75 }])],
  },
})

const TRISTANA = modelled('tristana', {
  // Draw a Bead only extends range; nothing to model one-on-one.
  passive: utility('tristana-passive', 'Draw a Bead', 1, null),
  q: {
    ...utility('tristana-q', 'Rapid Fire', 4, { byRank: [17, 16, 15, 14] }),
    effects: [{
      kind: 'castBuff', id: 'tristana-q-rapid-fire', name: 'Rapid Fire',
      description: 'Gains bonus Attack Speed for 7 seconds.', support: 'full',
      slots: ['q'], stat: 'attackSpeed', amount: { byRank: [0.6, 0.8, 1, 1.2] }, durationSeconds: 7, cooldownSeconds: 0,
    }],
  },
  w: {
    id: 'tristana-w', name: 'Rocket Jump', maxRank: 4, cooldown: { byRank: [20, 18, 16, 14] }, cost: 60, castTime: 0, flags: {},
    // The slow and the cooldown reset on a takedown are not modelled.
    damage: [magic({ byRank: [80, 120, 160, 200] }, [{ stat: 'bonusAd', value: 0.8 }, { stat: 'ap', value: 0.5 }])],
  },
  e: {
    id: 'tristana-e', name: 'Explosive Charge', maxRank: 4, cooldown: { byRank: [16, 15, 14, 13] },
    cost: { byRank: [55, 60, 65, 70] }, castTime: 0, flags: {},
    // The bomb's 4 second fuse and the stacking +25% per hit (up to 2x) from further attacks/abilities aren't
    // modelled, nor is the on-kill explosion (needs a kill to trigger). Crit scaling isn't either.
    damage: [physical({ byRank: [80, 110, 140, 170] }, [{ stat: 'bonusAd', value: 1.2 }, { stat: 'ap', value: 0.5 }])],
  },
  r: {
    id: 'tristana-r', name: 'Buster Shot', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [300, 350, 400] }, [{ stat: 'bonusAd', value: 0.7 }, { stat: 'ap', value: 1 }])],
  },
})

const LEONA = modelled('leona', {
  // Sunlight only empowers allies; it deals no damage of Leona's own.
  passive: utility('leona-passive', 'Sunlight', 1, null),
  q: {
    ...utility('leona-q', 'Shield of Daybreak', 4, 5, { byRank: [45, 50, 55, 60] }),
    effects: [{
      kind: 'empoweredAttack', id: 'leona-q-shield-of-daybreak', name: 'Shield of Daybreak',
      description: 'Empowers the next attack to deal 15 (+30% AP) bonus magic damage.',
      support: 'partial',
      supportNotes: 'The stun is not modelled. How long the empower lasts unused is not stated (10s assumed).',
      grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 1, durationSeconds: 10,
      bonus: magic({ byRank: [15, 50, 85, 120] }, [{ stat: 'ap', value: 0.3 }]),
    }],
  },
  w: {
    id: 'leona-w', name: 'Eclipse', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, cost: 60, castTime: 0, flags: {},
    // The Armor/MR gain and the defensive-bonus extension on a hit are not modelled.
    damage: [magic({ byRank: [80, 115, 150, 185] }, [{ stat: 'ap', value: 0.4 }])],
  },
  e: {
    id: 'leona-e', name: 'Zenith Blade', maxRank: 4, cooldown: { byRank: [12, 10, 8, 6] }, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 115, 170, 225] }, [{ stat: 'ap', value: 0.4 }])],
  },
  r: {
    id: 'leona-r', name: 'Solar Flare', maxRank: 3, cooldown: { byRank: [55, 45, 35] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [150, 225, 300] }, [{ stat: 'ap', value: 0.8 }])],
  },
})

/** The fourth most-picked champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH4: Champion[] = [MORDEKAISER, VIEGO, VEIGAR, TRISTANA, LEONA]
