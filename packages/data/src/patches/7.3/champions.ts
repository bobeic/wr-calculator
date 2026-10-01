import type { Champion, DamageComponent } from '@wr-calc/schema'
import { WRPOCKET_7_3_PROVENANCE } from './provenance'

// Hand-modelled champions: base stats copied from the generated wrpocket entry, kits written from
// the ability text with this repo's generic kit mechanics. These replace the generated entries with
// the same id. Values marked "unverified" are placeholders until checked in the practice tool.

/** "4/5/6/7% (+0.04% per bonus AD) of the target's max Health", as a damage ratio. */
const Q_MAX_HP_RATIO = {
  stat: 'targetMaxHp' as const,
  value: { byRank: [0.04, 0.05, 0.06, 0.07] },
  perStat: { stat: 'bonusAd' as const, value: 0.0004 },
}

const LACERATE: DamageComponent = {
  type: 'physical', base: { byRank: [40, 80, 120, 160] },
  ratios: [{ stat: 'bonusAd', value: { byRank: [0.5, 0.55, 0.6, 0.65] } }], tags: [],
}

const AMBESSA: Champion = {
  id: 'ambessa', name: 'Ambessa', resource: 'energy',
  baseStats: {
    hp: { base: 660, perLevel: 120 },
    hpRegen: { base: 8, perLevel: 0.785714 },
    armor: { base: 43, perLevel: 4.5 },
    mr: { base: 36, perLevel: 2 },
    ad: { base: 58, perLevel: 4.5 },
    moveSpeed: { base: 355, perLevel: 0 },
  },
  attackSpeed: { base: 0.8, ratio: 0.009375 },
  abilities: {
    passive: {
      id: 'ambessa-passive', name: "DRAKEHOUND'S STEP", maxRank: 1, cooldown: null, castTime: 0,
      damage: [], flags: {},
      effects: [{
        kind: 'empoweredAttack', id: 'ambessa-passive-drakehounds-step', name: "Drakehound's Step",
        description: 'After an ability, a feint dash empowers her next attack within 4 seconds: 50% '
          + 'Attack Speed, more range, 5-40 (based on level) (+25% bonus AD) bonus physical damage '
          + 'and 50/60/70 Energy (at levels 1/6/11). Stacks up to 3 times.',
        support: 'partial',
        // Verified 2026-09-30: 40 (+25% bonus AD) at level 15, 3 charges on one refreshed 4s timer,
        // and the bonus lands in the same damage number as the attack.
        supportNotes: 'Feint window of 0.275s is from the WR wiki, not checked in the practice tool. '
          + 'Values below level 15 assume a straight line from 5 to 40. Energy and range are not modeled.',
        grant: { on: 'dashAfterAbility', withinSeconds: 0.275 },
        maxCharges: 3, durationSeconds: 4, attackSpeedBonus: 0.5,
        bonus: {
          type: 'physical',
          base: { byLevel: Array.from({ length: 15 }, (_, index) => 5 + 2.5 * index) },
          ratios: [{ stat: 'bonusAd', value: 0.25 }], tags: [],
        },
      }],
    },
    q: {
      id: 'ambessa-q', name: 'CUNNING SWEEP', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] },
      cost: 70, castTime: 0, flags: {},
      // Edge hit (the 1v1 best case): 60/80/100/120 (+60% bonus AD) + max-HP ratio.
      damage: [{
        type: 'physical', base: { byRank: [60, 80, 100, 120] },
        ratios: [{ stat: 'bonusAd', value: 0.6 }, Q_MAX_HP_RATIO], tags: [],
      }],
      stages: [{
        id: 'ambessa-q-sundering-slam', name: 'SUNDERING SLAM', trigger: 'press', windowSeconds: 3.5,
        // First target hit: 70/100/130/160 (+90% bonus AD) + max-HP ratio.
        damage: [{
          type: 'physical', base: { byRank: [70, 100, 130, 160] },
          ratios: [{ stat: 'bonusAd', value: 0.9 }, Q_MAX_HP_RATIO], tags: [],
        }],
      }],
    },
    w: {
      id: 'ambessa-w', name: 'REPUDIATION', maxRank: 4, cooldown: { byRank: [17, 16, 15, 14] },
      cost: 70, castTime: 0, flags: {},
      // The stronger shockwave after blocking an immobilize isn't modeled (nothing to block 1v1).
      damage: [{
        type: 'physical', base: { byRank: [70, 100, 130, 160] },
        ratios: [{ stat: 'bonusAd', value: 0.8 }], tags: [],
      }],
    },
    e: {
      id: 'ambessa-e', name: 'LACERATE', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] },
      cost: 70, castTime: 0, flags: {},
      damage: [LACERATE],
      stages: [{
        id: 'ambessa-e-recast', name: 'LACERATE (RECAST)', trigger: 'dash', windowSeconds: 0.5,
        damage: [LACERATE],
      }],
    },
    r: {
      id: 'ambessa-r', name: 'PUBLIC EXECUTION', maxRank: 3, cooldown: { byRank: [80, 70, 60] },
      // 0.55s cast (WR wiki) plus the 1s suppression before the slam (in-game tooltip); not timed.
      castTime: 1.55, flags: {},
      // 10/17.5/25% (+5% per 100 bonus AD) missing HP since patch 7.2b (WR wiki patch history); the
      // in-game tooltip at rank 3 with no bonus AD reads "400 + 25% of their missing health".
      // Unexplained extra (parked 2026-10-01): R deals ~57 more pre-mitigation damage than the
      // tooltip on both a full-HP dummy (270, not 236) and a full-HP Garen with 114 armor (254, not
      // 223), with no damaging runes. A fixed bonus or a hidden ~14% amp would fit; not modeled.
      damage: [{
        type: 'physical', base: { byRank: [200, 300, 400] },
        ratios: [{
          stat: 'targetMissingHp', value: { byRank: [0.1, 0.175, 0.25] },
          perStat: { stat: 'bonusAd', value: 0.0005 },
        }],
        tags: [],
      }],
      effects: [{
        kind: 'stat', id: 'ambessa-r-passive-armor-pen', name: 'Public Execution (passive)',
        description: 'Gains 10/20/30% Armor Penetration.',
        // Verified 2026-09-30: a level-15 attack on the 100-armor dummy dealt 72 (121 x 100/170).
        support: 'partial', supportNotes: 'Ability healing (17.5% of damage at rank 3) is not modeled.',
        stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
      }],
    },
  },
  provenance: WRPOCKET_7_3_PROVENANCE,
}

export const HAND_MODELED_CHAMPIONS: Champion[] = [AMBESSA]
