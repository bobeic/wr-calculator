import type { Champion, DamageComponent } from '@wr-calc/schema'
import { WRPOCKET_7_3_PROVENANCE } from './provenance'

// Hand-modelled champions: base stats copied from the generated wrpocket entry, kits written from
// the ability text with this repo's generic kit mechanics. These replace the generated entries with
// the same id. Values marked "unverified" are placeholders until checked in the practice tool.

const UNVERIFIED = 'Placeholder from the ability text; not yet checked in the practice tool.'

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
          + 'Attack Speed, more range, 5 + 2.5 (based on level) (+25% bonus AD) bonus physical '
          + 'damage and 50 Energy. Stacks up to 3 times.',
        support: 'partial',
        supportNotes: `${UNVERIFIED} Level scaling assumed 5 + 2.5 per level; feint window assumed 0.5s. `
          + 'Energy and range are not modeled.',
        grant: { on: 'dashAfterAbility', withinSeconds: 0.5 },
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
      // The 1-second suppression before the slam (unverified).
      castTime: 1, flags: {},
      damage: [{
        type: 'physical', base: { byRank: [200, 300, 400] },
        ratios: [{
          stat: 'targetMissingHp', value: 0.1, perStat: { stat: 'bonusAd', value: 0.0005 },
        }],
        tags: [],
      }],
      effects: [{
        kind: 'stat', id: 'ambessa-r-passive-armor-pen', name: 'Public Execution (passive)',
        description: 'Gains 10/20/30% Armor Penetration.',
        support: 'partial', supportNotes: `${UNVERIFIED} Spell vamp is not modeled.`,
        stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
      }],
    },
  },
  provenance: WRPOCKET_7_3_PROVENANCE,
}

export const HAND_MODELED_CHAMPIONS: Champion[] = [AMBESSA]
