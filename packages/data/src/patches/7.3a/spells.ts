import type { SummonerSpell } from '@wr-calc/schema'

// Summoner spells, from wrpocket's 7.3a text (snapshots/wrpocket/7.3a/spells.json), first modelled 2026-10-02 and
// unchecked in game. Only damage is modelled; the rest are listed so a build can name them.
const spell = (id: string, name: string, effects: SummonerSpell['effects'] = []): SummonerSpell => ({ id, name, effects })

export const SPELLS_7_3A: SummonerSpell[] = [
  spell('ignite', 'Ignite', [{
    kind: 'active', id: 'ignite-burn', name: 'Ignite',
    description: 'Ignites target enemy champion, dealing 72 true damage (72–380) over 5 seconds and applying 60% '
      + 'Grievous Wounds for the duration.',
    support: 'partial',
    // wrpocket's text gives the range but no cooldown; 90s is League's and is unverified for Wild Rift.
    supportNotes: '72–380 is taken as linear over levels 1–15, ticking once a second. The cooldown (90s) is unverified. '
      + 'Grievous Wounds is not modelled.',
    cooldownSeconds: 90, damageType: 'true', damage: { levelRange: { min: 72, max: 380 } },
    overTime: { durationSeconds: 5, tickIntervalSeconds: 1 },
  }]),
  spell('smite', 'Smite', [{
    kind: 'active', id: 'smite-champion', name: 'Smite (upgraded, on a champion)',
    description: 'Upgraded Smite can be used on champions, dealing 40 true damage and stealing 25% of the target\'s '
      + 'Movement Speed for 2 seconds. Gain 1 charge every 45 seconds. Up to 2 charges.',
    support: 'partial', supportNotes: 'Needs the toggle (Smite upgraded). One charge per combo.',
    cooldownSeconds: 45, damageType: 'true', damage: 40,
    condition: { type: 'toggle', inputId: 'smite-upgraded' },
    inputs: [{ type: 'boolean', id: 'smite-upgraded', label: 'Smite upgraded (usable on champions)', default: false }],
  }]),
  spell('flash', 'Flash'),
  spell('ghost', 'Ghost'),
  spell('heal', 'Heal'),
  spell('barrier', 'Barrier'),
  spell('exhaust', 'Exhaust'),
  spell('cleanse', 'Cleanse'),
  spell('teleport', 'Teleport'),
]
