import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 26 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Shen (Baron), Fiddlesticks (Jungle), Heimerdinger (Mid) and Zilean (Support); every Dragon-lane pick is already
// modelled, and Zilean is the last Support-lane one. Same approach as the earlier batches:
// wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const SHEN = modelled('shen', {
  // Ki Barrier is a shield.
  passive: utility('shen-passive', 'Ki Barrier', 1, null),
  q: {
    ...utility('shen-q', 'Twilight Assault', 4, { byRank: [8, 7, 6, 5] }, { byRank: [75, 70, 65, 60] }),
    effects: [
      {
        kind: 'empoweredAttack', id: 'shen-q-twilight-assault', name: 'Twilight Assault',
        description: "The next 3 attacks deal an additional 5.5% (+2% AP) of the target's max Health as magic damage "
          + '(the Spirit Blade passed through the target).',
        support: 'partial',
        supportNotes: "Always the empowered version (the blade passed through the champion). How long the empower lasts "
          + "isn't stated (8 seconds assumed).",
        grant: { on: 'abilityCast', slots: ['q'], charges: 3 }, maxCharges: 3, durationSeconds: 8,
        bonus: magic(0, [{ stat: 'targetMaxHp', value: { byRank: [0.055, 0.06, 0.065, 0.07] }, perStat: { stat: 'ap', value: 0.0002 } }]),
      },
      {
        kind: 'castBuff', id: 'shen-q-attack-speed', name: 'Twilight Assault (attack speed)',
        description: 'Gains 50% Attack Speed for the 3 empowered attacks.', support: 'full',
        slots: ['q'], stat: 'attackSpeed', amount: 0.5, durationSeconds: 8, cooldownSeconds: 0, charges: 3,
      },
    ],
  },
  // Spirit's Refuge blocks attacks.
  w: utility('shen-w', "Spirit's Refuge", 4, { byRank: [18, 16, 14, 12] }, 20),
  e: {
    id: 'shen-e', name: 'Shadow Dash', maxRank: 4, cooldown: { byRank: [16, 14, 12, 10] }, cost: 75, castTime: 0, flags: {},
    damage: [physical({ byRank: [60, 90, 120, 150] }, [{ stat: 'bonusHp', value: 0.15 }])],
  },
  // Stand United shields an ally.
  r: utility('shen-r', 'Stand United', 3, { byRank: [110, 100, 90] }),
})

const FIDDLESTICKS = modelled('fiddlesticks', {
  // A Harmless Scarecrow needs a takedown.
  passive: utility('fiddlesticks-passive', 'A Harmless Scarecrow', 1, null),
  q: {
    id: 'fiddlesticks-q', name: 'Terrify', maxRank: 4, cooldown: { byRank: [13.5, 13, 12.5, 12] }, cost: 65, castTime: 0, flags: {},
    // The 45-120 minimum and the 200% on recently feared targets are not modelled.
    damage: [magic(0, [{ stat: 'targetCurrentHp', value: { byRank: [0.04, 0.05, 0.06, 0.07] }, perStat: { stat: 'ap', value: 0.00015 } }])],
  },
  w: {
    id: 'fiddlesticks-w', name: 'Bountiful Harvest', maxRank: 4, cooldown: { byRank: [11, 10, 9, 8] }, cost: { byRank: [60, 65, 70, 75] },
    castTime: 0, flags: {},
    // The full 2 second channel at once, then 10% of missing Health.
    damage: [
      { ...magic({ byRank: [60, 90, 120, 150] }, [{ stat: 'ap', value: 0.3 }]), hits: 2 },
      magic(0, [{ stat: 'targetMissingHp', value: { byRank: [0.1, 0.115, 0.13, 0.145] } }]),
    ],
  },
  e: {
    id: 'fiddlesticks-e', name: 'Reap', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: { byRank: [40, 45, 50, 55] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 120, 170, 220] }, [{ stat: 'ap', value: 0.5 }])],
  },
  r: {
    ...utility('fiddlesticks-r', 'Crowstorm', 3, { byRank: [100, 80, 60] }, 100),
    effects: [{
      kind: 'dot', id: 'fiddlesticks-r-crowstorm', name: 'Crowstorm',
      description: 'Deals 30 (+10% AP) magic damage every 0.25 seconds for 5 seconds, up to 600 magic damage.',
      support: 'partial',
      supportNotes: 'Even rank 1 with no AP reaches the 600 cap (20 ticks of 30), so it is 20 ticks of 30 at every rank. '
        + 'The 1.5 second channel is not modelled.',
      damageType: 'magic', tickAmount: 30, tickIntervalSeconds: 0.25, durationSeconds: 5,
      refresh: 'refresh', appliedBy: ['r'], ratios: [],
    }],
  },
})

const HEIMERDINGER = modelled('heimerdinger', {
  // Hextech Affinity is movement speed.
  passive: utility('heimerdinger-passive', 'Hextech Affinity', 1, null),
  // H-28G Evolution Turret: the turrets' attacks are not modelled.
  q: utility('heimerdinger-q', 'H-28G Evolution Turret', 4, 1, 20),
  w: {
    id: 'heimerdinger-w', name: 'Hextech Micro-Rockets', maxRank: 4, cooldown: { byRank: [10, 9, 8, 7] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    // All 5 rockets hit the target: the first in full, the other 4 at 20%.
    damage: [
      magic({ byRank: [60, 85, 110, 135] }, [{ stat: 'ap', value: 0.6 }]),
      { ...magic({ byRank: [12, 17, 22, 27] }, [{ stat: 'ap', value: 0.12 }]), hits: 4 },
    ],
  },
  e: {
    id: 'heimerdinger-e', name: 'CH-2 Electron Storm Grenade', maxRank: 4, cooldown: 11, cost: 85, castTime: 0, flags: {},
    damage: [magic({ byRank: [70, 120, 170, 220] }, [{ stat: 'ap', value: 0.6 }])],
  },
  // UPGRADE!!!'s upgraded abilities are not modelled.
  r: utility('heimerdinger-r', 'UPGRADE!!!', 3, { byRank: [80, 70, 60] }, 100),
})

const ZILEAN = modelled('zilean', {
  // Time in a Bottle stores Experience.
  passive: utility('zilean-passive', 'Time in a Bottle', 1, null),
  q: {
    id: 'zilean-q', name: 'Time Bomb', maxRank: 4, cooldown: 0.1, cost: { byRank: [60, 65, 70, 75] }, castTime: 0, flags: {},
    // Detonates at once (the 3 second fuse is not modelled). Its 2 charges are not modelled either: the 0.1 second
    // cooldown lets the combo recast it freely.
    damage: [magic({ byRank: [60, 125, 190, 255] }, [{ stat: 'ap', value: 0.75 }])],
  },
  // Twisted Timeflow, Temporal Mirage and Chronoshift are shields, slows and a revive.
  w: utility('zilean-w', 'Twisted Timeflow', 4, { byRank: [14.5, 13.5, 12.5, 11.5] }, 35),
  e: utility('zilean-e', 'Temporal Mirage', 4, 25, 50),
  r: utility('zilean-r', 'Chronoshift', 3, { byRank: [110, 95, 80] }, { byRank: [125, 150, 175] }),
})

/** The twenty-sixth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH26: Champion[] = [SHEN, FIDDLESTICKS, HEIMERDINGER, ZILEAN]
