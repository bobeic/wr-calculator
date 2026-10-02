import type { Champion } from '@wr-calc/schema'
import { byLevelLine, magic, modelled, physical, utility } from './champion-helpers'

// Batch 10 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// K'Sante (Baron), Kayn (Jungle), Ahri (Mid), Ashe (Dragon) and Lulu (Support). Same approach as the earlier
// batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one damage dealt, nothing checked in game yet.

const KSANTE = modelled('ksante', {
  passive: {
    id: 'ksante-passive', name: 'Dauntless Instinct', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'spellblade', id: 'ksante-passive-dauntless-instinct', name: 'Dauntless Instinct',
      description: "Damaging abilities mark enemies. Attacking a marked target deals physical damage equal to 12 plus "
        + '1%-2% (based on level) of their max Health and consumes the mark.',
      support: 'partial',
      supportNotes: 'Acts like a spellblade (the attack after an ability). Values between levels 1 and 15 assume a '
        + 'straight line. All Out (his ultimate state) is not modelled anywhere in this kit.',
      damageType: 'physical', bonusDamage: 12, ratios: [], pctTargetMaxHp: byLevelLine(0.01, 0.02), internalCooldownSeconds: 0,
    }],
  },
  q: {
    id: 'ksante-q', name: 'Ntofo Strikes', maxRank: 4, cooldown: 3.5, cost: 20, castTime: 0, flags: {},
    // The cooldown cut from bonus resists is not modelled.
    damage: [physical({ byRank: [80, 120, 160, 200] }, [{ stat: 'bonusArmor', value: 0.35 }, { stat: 'bonusMr', value: 0.35 }])],
  },
  w: {
    id: 'ksante-w', name: 'Path Maker', maxRank: 4, cooldown: { byRank: [13, 12, 11, 10] }, cost: { byRank: [40, 45, 50, 55] },
    castTime: 0, flags: {},
    // The charge-up (0.3-0.75s) is not modelled.
    damage: [physical({ byRank: [50, 80, 110, 140] }, [
      { stat: 'targetMaxHp', value: 0.08, perStat: { stat: 'bonusArmor', value: 0.0002 } },
      { stat: 'targetMaxHp', value: 0, perStat: { stat: 'bonusMr', value: 0.0002 } },
    ])],
  },
  // Footwork is a dash and a shield.
  e: utility('ksante-e', 'Footwork', 4, { byRank: [11, 10, 9, 8] }, { byRank: [40, 45, 50, 55] }),
  r: {
    id: 'ksante-r', name: 'All Out', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // Only the first hit: Demolishing Strike needs a wall, and the All Out state (upgraded abilities, attack speed,
    // armor pen, lost resists) is not modelled.
    damage: [physical({ byRank: [80, 115, 150] }, [])],
  },
})

const KAYN = modelled('kayn', {
  // The Darkin Scythe's two forms need a transformation; base Kayn is modelled.
  passive: utility('kayn-passive', 'The Darkin Scythe', 1, null),
  q: {
    id: 'kayn-q', name: 'Reaping Slash', maxRank: 4, cooldown: { byRank: [6.5, 6, 5.5, 5] }, cost: 50, castTime: 0, flags: {},
    // The dash and the spin both hit.
    damage: [{ ...physical({ byRank: [70, 100, 130, 160] }, [{ stat: 'bonusAd', value: { byRank: [0.6, 0.65, 0.7, 0.75] } }]), hits: 2 }],
  },
  w: {
    id: 'kayn-w', name: "Blade's Reach", maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] }, cost: { byRank: [50, 60, 70, 80] },
    castTime: 0, flags: {},
    damage: [physical({ byRank: [105, 165, 225, 285] }, [{ stat: 'bonusAd', value: 1.2 }])],
  },
  // Shadow Step is movement and a heal.
  e: utility('kayn-e', 'Shadow Step', 4, { byRank: [18, 16, 14, 12] }, 50),
  r: {
    id: 'kayn-r', name: 'Umbral Trespass', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    // Lands at once (the 2.5 second infestation isn't modelled).
    damage: [physical({ byRank: [200, 300, 400] }, [{ stat: 'bonusAd', value: 1.65 }])],
  },
})

const AHRI = modelled('ahri', {
  // Essence Theft heals.
  passive: utility('ahri-passive', 'Essence Theft', 1, null),
  q: {
    id: 'ahri-q', name: 'Orb of Deception', maxRank: 4, cooldown: 7, cost: { byRank: [65, 70, 75, 80] }, castTime: 0, flags: {},
    // Out (magic) and back (true), both at once.
    damage: [
      magic({ byRank: [40, 75, 110, 145] }, [{ stat: 'ap', value: 0.45 }]),
      { type: 'true', base: { byRank: [40, 75, 110, 145] }, ratios: [{ stat: 'ap', value: 0.45 }], tags: [] },
    ],
  },
  w: {
    id: 'ahri-w', name: 'Fox-Fire', maxRank: 4, cooldown: { byRank: [8, 7, 6, 5] }, cost: 50, castTime: 0, flags: {},
    // All 3 fox-fires on one target: the first at full damage, the other 2 at 30%.
    damage: [
      magic({ byRank: [45, 80, 115, 150] }, [{ stat: 'ap', value: 0.35 }]),
      { ...magic({ byRank: [13.5, 24, 34.5, 45] }, [{ stat: 'ap', value: 0.105 }]), hits: 2 },
    ],
  },
  e: {
    id: 'ahri-e', name: 'Charm', maxRank: 4, cooldown: 12, cost: 85, castTime: 0, flags: {},
    damage: [magic({ byRank: [60, 100, 140, 180] }, [{ stat: 'ap', value: 0.5 }])],
  },
  r: {
    id: 'ahri-r', name: 'Spirit Rush', maxRank: 3, cooldown: { byRank: [75, 65, 55] }, cost: 100, castTime: 0, flags: {},
    // All 3 casts at once (one bolt each on the target).
    damage: [{ ...magic({ byRank: [60, 90, 120] }, [{ stat: 'ap', value: 0.35 }]), hits: 3 }],
  },
})

const ASHE = modelled('ashe', {
  // Frost Shot: crits deal no extra damage, attacks instead deal crit rate x crit damage more. Not modelled: in the
  // 'average' crit mode that matches the expected crit; in the other crit modes it doesn't.
  passive: utility('ashe-passive', 'Frost Shot', 1, null),
  q: {
    // Needs 4 Focus stacks (from attacks) rather than a cooldown; the combo decides when.
    ...utility('ashe-q', "Ranger's Focus", 4, null, 30),
    effects: [
      {
        kind: 'castBuff', id: 'ashe-q-attack-speed', name: "Ranger's Focus",
        description: 'Gains 20% Attack Speed for 6 seconds.', support: 'full',
        slots: ['q'], stat: 'attackSpeed', amount: { byRank: [0.2, 0.3, 0.4, 0.5] }, durationSeconds: 6, cooldownSeconds: 0,
      },
      {
        kind: 'empoweredAttack', id: 'ashe-q-flurry', name: "Ranger's Focus (flurry)",
        description: 'While active, her attack is transformed into a flurry of arrows, dealing 115% physical damage.',
        support: 'partial', supportNotes: 'Read as +15-30% AD on every attack for 6 seconds.',
        grant: { on: 'abilityCast', slots: ['q'], charges: 99 }, maxCharges: 99, durationSeconds: 6,
        bonus: physical(0, [{ stat: 'totalAd', value: { byRank: [0.15, 0.2, 0.25, 0.3] } }]),
      },
    ],
  },
  w: {
    id: 'ashe-w', name: 'Volley', maxRank: 4, cooldown: { byRank: [15, 12, 9, 6] }, cost: { byRank: [65, 60, 55, 50] },
    castTime: 0, flags: {},
    // One arrow per target.
    damage: [physical({ byRank: [70, 110, 150, 190] }, [{ stat: 'bonusAd', value: 1 }])],
  },
  // Hawkshot only grants vision.
  e: utility('ashe-e', 'Hawkshot', 4, { byRank: [45, 40, 35, 30] }),
  r: {
    id: 'ashe-r', name: 'Enchanted Crystal Arrow', maxRank: 3, cooldown: { byRank: [80, 70, 60] }, cost: 100, castTime: 0, flags: {},
    damage: [magic({ byRank: [200, 350, 500] }, [{ stat: 'ap', value: 0.4 }])],
  },
})

const LULU = modelled('lulu', {
  passive: {
    id: 'lulu-passive', name: 'Pix, Faerie Companion', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'onHit', id: 'lulu-passive-pix', name: 'Pix',
      description: 'Pix fires 3 bolts that deal a total of 12 (+15% AP) magic damage when Lulu attacks an enemy unit.',
      support: 'partial', supportNotes: "All 3 bolts hit. Any level scaling isn't stated, so 12 is used at every level.",
      damageType: 'magic', flat: 12, ratios: [{ stat: 'ap', value: 0.15 }],
    }],
  },
  q: {
    id: 'lulu-q', name: 'Glitterlance', maxRank: 4, cooldown: 7, cost: { byRank: [50, 55, 60, 65] }, castTime: 0, flags: {},
    // One bolt on the target (Lulu's and Pix's bolts both hitting it isn't assumed).
    damage: [magic({ byRank: [50, 85, 120, 155] }, [{ stat: 'ap', value: 0.3 }])],
  },
  // Whimsy polymorphs an enemy or speeds an ally.
  w: utility('lulu-w', 'Whimsy', 4, { byRank: [17, 16, 15, 14] }, 65),
  e: {
    id: 'lulu-e', name: 'Help, Pix!', maxRank: 4, cooldown: 10, cost: { byRank: [60, 70, 80, 90] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 120, 160, 200] }, [{ stat: 'ap', value: 0.4 }])],
  },
  // Wild Growth enlarges an ally.
  r: utility('lulu-r', 'Wild Growth', 3, { byRank: [80, 70, 60] }, 100),
})

/** The tenth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH10: Champion[] = [KSANTE, KAYN, AHRI, ASHE, LULU]
