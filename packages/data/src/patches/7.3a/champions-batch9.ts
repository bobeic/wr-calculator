import type { Champion } from '@wr-calc/schema'
import { magic, modelled, physical, utility } from './champion-helpers'

// Batch 9 (2026-10-02): the next most-picked unmodelled champion per lane on the CN server (all ranks, 2026-09-30):
// Volibear (Baron), Jarvan IV (Jungle), Morgana (Mid; also next in Support), Kai'Sa (Dragon) and Yuumi (Support, the
// next after Morgana). Same approach as the earlier batches: wrpocket.app/site_data/champions/<slug>.json, one-on-one
// damage dealt, nothing checked in game yet.

const VOLIBEAR = modelled('volibear', {
  passive: {
    id: 'volibear-passive', name: 'The Relentless Storm', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'attackStack', id: 'volibear-passive-attack-speed', name: 'The Relentless Storm',
      description: 'Gains 5% (+4% AP) Attack Speed for 6 seconds whenever he deals damage with an ability or attack, '
        + 'stacking up to 5 times. At 5 stacks, his attacks deal an additional 12-68 (based on level) (+40% AP) magic '
        + 'damage.',
      support: 'partial',
      supportNotes: "Only the 5% per stack: the +4% AP part and the lightning at 5 stacks are not modelled (no hook "
        + 'adds on-hit damage only at full stacks).',
      stat: 'attackSpeed', amountPerStack: 0.05, stacksFrom: ['basicAttack', 'ability'], maxStacks: 5, durationSeconds: 6,
    }],
  },
  q: {
    ...utility('volibear-q', 'Thundering Smash', 4, { byRank: [13, 12, 11, 10] }, 50),
    effects: [{
      kind: 'empoweredAttack', id: 'volibear-q-thundering-smash', name: 'Thundering Smash',
      description: "For 4 seconds, Volibear's next attack deals 15 (+100% bonus AD) physical damage and stuns.",
      support: 'partial', supportNotes: 'The stun and movement speed are not modelled.',
      grant: { on: 'abilityCast', slots: ['q'], charges: 1 }, maxCharges: 1, durationSeconds: 4,
      bonus: physical({ byRank: [15, 40, 65, 90] }, [{ stat: 'bonusAd', value: 1 }]),
    }],
  },
  w: {
    id: 'volibear-w', name: 'Frenzied Maul', maxRank: 4, cooldown: 5, cost: { byRank: [35, 40, 45, 50] }, castTime: 0, flags: {},
    // The un-Frenzied cast only: the stronger second cast within 8 seconds (8/48/88/128 +160% AD +10.4% bonus Health),
    // the heal and applying on-hit effects are not modelled.
    damage: [physical({ byRank: [5, 30, 55, 80] }, [{ stat: 'totalAd', value: 1 }, { stat: 'bonusHp', value: 0.065 }])],
  },
  e: {
    id: 'volibear-e', name: 'Sky Splitter', maxRank: 4, cooldown: 13, cost: 60, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 110, 140, 170] }, [{ stat: 'ap', value: 0.5 }, { stat: 'targetMaxHp', value: 0.11 }])],
  },
  r: {
    id: 'volibear-r', name: 'Stormbringer', maxRank: 3, cooldown: { byRank: [90, 80, 70] }, cost: 100, castTime: 0, flags: {},
    // The target is directly underneath. The Health and range gain are not modelled.
    damage: [physical({ byRank: [300, 500, 700] }, [{ stat: 'ap', value: 1 }, { stat: 'bonusAd', value: 2.1 }])],
  },
})

const JARVAN_IV = modelled('jarvan-iv', {
  passive: {
    id: 'jarvan-iv-passive', name: 'Martial Cadence', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [{
      kind: 'abilityHitProc', id: 'jarvan-iv-passive-martial-cadence', name: 'Martial Cadence',
      description: "The first attack against an enemy deals bonus physical damage equal to 8% of their current Health "
        + '(5 second cooldown per unique enemy).',
      support: 'partial', supportNotes: "Reads the target's Health after the attack itself has landed.",
      triggeredBy: ['basicAttack'], damageType: 'physical', damage: 0, ratios: [], pctTargetCurrentHp: 0.08, cooldownSeconds: 5,
    }],
  },
  q: {
    id: 'jarvan-iv-q', name: 'Dragon Strike', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: { byRank: [50, 55, 60, 65] },
    castTime: 0, flags: {},
    // The 10-25% Armor reduction isn't modelled: a shred applies on any damage, so it can't be limited to Q.
    damage: [physical({ byRank: [80, 140, 200, 260] }, [{ stat: 'bonusAd', value: 1.3 }])],
  },
  // Golden Aegis is a shield and slow.
  w: utility('jarvan-iv-w', 'Golden Aegis', 4, 10, 30),
  e: {
    id: 'jarvan-iv-e', name: 'Demacian Standard', maxRank: 4, cooldown: { byRank: [11, 10.5, 10, 9.5] }, cost: 55, castTime: 0, flags: {},
    damage: [magic({ byRank: [85, 140, 195, 250] }, [{ stat: 'ap', value: 0.8 }])],
    effects: [{
      kind: 'stat', id: 'jarvan-iv-e-passive', name: 'Demacian Standard (passive)', description: 'Gains 25% Attack Speed.',
      support: 'partial', supportNotes: "The standard's own aura (30-45% for allies nearby) is not modelled.",
      stat: 'attackSpeed', amount: { byRank: [0.25, 0.3, 0.35, 0.4] },
    }],
  },
  r: {
    id: 'jarvan-iv-r', name: 'Cataclysm', maxRank: 3, cooldown: { byRank: [70, 65, 60] }, cost: 100, castTime: 0, flags: {},
    // The arena's 12-20% damage reduction applies to the enemy's damage; not modelled.
    damage: [physical({ byRank: [200, 350, 500] }, [{ stat: 'bonusAd', value: 1.7 }])],
  },
})

const MORGANA = modelled('morgana', {
  // Soul Siphon heals.
  passive: utility('morgana-passive', 'Soul Siphon', 1, null),
  q: {
    id: 'morgana-q', name: 'Dark Binding', maxRank: 4, cooldown: 9, cost: { byRank: [55, 60, 65, 70] }, castTime: 0, flags: {},
    damage: [magic({ byRank: [80, 160, 240, 320] }, [{ stat: 'ap', value: 0.9 }])],
  },
  w: {
    id: 'morgana-w', name: 'Tormented Shadow', maxRank: 4, cooldown: 12, cost: { byRank: [70, 90, 110, 130] }, castTime: 0, flags: {},
    // The first tick; the dot below deals the other 9.
    damage: [magic({ byRank: [7, 12, 17, 22] }, [{ stat: 'ap', value: 0.07 }])],
    effects: [{
      kind: 'dot', id: 'morgana-w-tormented-shadow', name: 'Tormented Shadow',
      description: 'Curses an area for 5 seconds, dealing 7 (+7% AP) magic damage every 0.5 seconds to enemies within, '
        + 'increased by up to 170% based on their missing Health.',
      support: 'partial',
      supportNotes: 'The target stays in the area for all 5 seconds. The up-to-170% increase from missing Health is not '
        + 'modelled.',
      damageType: 'magic', tickAmount: { byRank: [7, 12, 17, 22] }, tickIntervalSeconds: 0.5, durationSeconds: 4.5,
      refresh: 'refresh', appliedBy: ['w'], ratios: [{ stat: 'ap', value: 0.07 }],
    }],
  },
  // Black Shield shields an ally.
  e: utility('morgana-e', 'Black Shield', 4, { byRank: [13, 12, 11, 10] }, 60),
  r: {
    id: 'morgana-r', name: 'Soul Shackles', maxRank: 3, cooldown: { byRank: [75, 65, 55] }, cost: 100, castTime: 0, flags: {},
    // Both hits at once: the target is assumed not to break the chains in 3 seconds.
    damage: [{ ...magic({ byRank: [150, 225, 300] }, [{ stat: 'ap', value: 0.7 }]), hits: 2 }],
  },
})

const KAISA = modelled('kaisa', {
  passive: {
    id: 'kaisa-passive', name: 'Second Skin', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    effects: [
      {
        kind: 'onHit', id: 'kaisa-passive-caustic-wounds', name: 'Caustic Wounds',
        description: 'Attacks deal 5 (based on level) (+12% AP) bonus magic damage, +2 (based on level) (+2% AP) per '
          + 'Plasma stack on the target.',
        support: 'partial',
        supportNotes: "5 at every level (the level scaling isn't stated); the extra damage per Plasma stack is not "
          + 'modelled.',
        damageType: 'magic', flat: 5, ratios: [{ stat: 'ap', value: 0.12 }],
      },
      {
        kind: 'hitStackProc', id: 'kaisa-passive-plasma', name: 'Plasma',
        description: "Plasma detonates at 5 stacks, dealing 15% (+5% per 100 AP) of the target's missing Health as "
          + 'magic damage.',
        support: 'partial',
        supportNotes: "One stack per attack within 4 seconds; Void Seeker's 2 stacks and allies' stacks are not "
          + 'modelled. "+5% AP" is read as +5% per 100 AP.',
        stacksToProc: 5, stackWindowSeconds: 4, cooldownSeconds: 0, stacksFrom: ['basicAttack'],
        damage: { type: 'magic', base: 0, ratios: [{ stat: 'targetMissingHp', value: 0.15, perStat: { stat: 'ap', value: 0.0005 } }], tags: [] },
        delivery: { kind: 'instant' },
      },
    ],
  },
  q: {
    id: 'kaisa-q', name: 'Icathian Rain', maxRank: 4, cooldown: { byRank: [9, 8, 7, 6] }, cost: 55, castTime: 0, flags: {},
    // All 6 missiles on one target: the first at full damage, the other 5 at 25%. Living Weapon (12 missiles) is not
    // modelled.
    damage: [
      physical({ byRank: [40, 60, 80, 100] }, [{ stat: 'bonusAd', value: 0.5 }, { stat: 'ap', value: 0.3 }]),
      { ...physical({ byRank: [10, 15, 20, 25] }, [{ stat: 'bonusAd', value: 0.125 }, { stat: 'ap', value: 0.075 }]), hits: 5 },
    ],
  },
  w: {
    id: 'kaisa-w', name: 'Void Seeker', maxRank: 4, cooldown: { byRank: [20, 18, 16, 14] }, cost: { byRank: [60, 65, 70, 75] },
    castTime: 0, flags: {},
    damage: [magic({ byRank: [30, 60, 90, 120] }, [{ stat: 'totalAd', value: 1.3 }, { stat: 'ap', value: 0.5 }])],
  },
  e: {
    ...utility('kaisa-e', 'Supercharge', 4, { byRank: [16, 14, 12, 10] }, 30),
    effects: [{
      kind: 'castBuff', id: 'kaisa-e-supercharge', name: 'Supercharge',
      description: 'For 4 seconds after charging, gains bonus Attack Speed.',
      support: 'partial', supportNotes: 'The 0.92 second charge-up is not modelled; the buff starts at the cast.',
      slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.4, 0.5, 0.6, 0.7] }, durationSeconds: 4, cooldownSeconds: 0,
    }],
  },
  // Killer Instinct is a dash and a shield.
  r: utility('kaisa-r', 'Killer Instinct', 3, { byRank: [80, 70, 60] }, 100),
})

const YUUMI = modelled('yuumi', {
  // Feline Friendship heals; the Best Friend bonuses need an ally.
  passive: utility('yuumi-passive', 'Feline Friendship', 1, null),
  q: {
    id: 'yuumi-q', name: 'Prowling Projectile', maxRank: 5, cooldown: 5, cost: 60, castTime: 0, flags: {},
    // Unattached (Yuumi on her own): the attached version's 100-340 (+35% AP) is not modelled.
    damage: [magic({ byRank: [60, 100, 140, 180, 220] }, [{ stat: 'ap', value: 0.2 }])],
  },
  // You and Me! attaches to an ally.
  w: utility('yuumi-w', 'You and Me!', 4, 8),
  e: {
    ...utility('yuumi-e', 'Zoomies', 4, 9, { byRank: [65, 75, 85, 95] }),
    effects: [{
      kind: 'castBuff', id: 'yuumi-e-zoomies', name: 'Zoomies',
      description: 'Gains a shield and 24% (+8% AP) Attack Speed for 3 seconds.',
      support: 'partial', supportNotes: 'The +8% AP part and the shield are not modelled.',
      slots: ['e'], stat: 'attackSpeed', amount: { byRank: [0.24, 0.28, 0.32, 0.36] }, durationSeconds: 3, cooldownSeconds: 0,
    }],
  },
  r: {
    id: 'yuumi-r', name: 'Final Chapter', maxRank: 3, cooldown: { byRank: [85, 75, 65] }, cost: 100, castTime: 0, flags: {},
    // All 7 waves land at once (the 3.5 second channel isn't modelled). "Waves after the first deal 20 (+5% AP)" is
    // read as the later 6 waves dealing 20/30/40 (+5% AP) each.
    damage: [
      magic({ byRank: [80, 100, 120] }, [{ stat: 'ap', value: 0.15 }]),
      { ...magic({ byRank: [20, 30, 40] }, [{ stat: 'ap', value: 0.05 }]), hits: 6 },
    ],
  },
})

/** The ninth batch: the next most-picked unmodelled champion per lane on the CN server. */
export const HAND_MODELED_CHAMPIONS_BATCH9: Champion[] = [VOLIBEAR, JARVAN_IV, MORGANA, KAISA, YUUMI]
