import { describe, it, expect } from 'vitest'
import type { Champion, DamageComponent, Effect } from '@wr-calc/schema'
import { combatantFromChampion, combatantFromDummy } from '../src/combatant'
import { simulateCombo } from '../src/simulate-combo'

const magic = (base: number, ratios: DamageComponent['ratios'] = []): DamageComponent => ({ type: 'magic', base, ratios, tags: [] })

// A Q with three spells, and an effect that fires only for its W variant.
const onlyWVariant: Effect = {
  kind: 'empoweredAttack', id: 'v-empower', name: 'Empower', description: '', support: 'full',
  condition: { type: 'abilityVariant', value: 'w' },
  grant: { on: 'abilityCast', slots: ['q'] }, maxCharges: 1, durationSeconds: 5,
  bonus: { type: 'true', base: 50, ratios: [], tags: [] },
}

function champion(): Champion {
  const ability = (id: string, maxRank: number) => ({ id, name: id, maxRank, cooldown: 10, castTime: 0, damage: [], flags: {} })
  return {
    id: 'v', name: 'Variant Champ', resource: 'none',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 100, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    provenance: { source: 'manual', patch: 'test', verifiedInGame: false },
    abilities: {
      passive: ability('p', 1), w: ability('w', 4), e: ability('e', 4), r: ability('r', 3),
      q: {
        ...ability('q', 4), effects: [onlyWVariant],
        variants: [
          { id: 'v-q-fire', key: 'q', name: 'Fire', damage: [magic(100)] },
          { id: 'v-q-bolt', key: 'w', name: 'Bolt', castTime: 0.5, damage: [magic(80, [{ stat: 'targetMissingHpFraction', value: 200 }])] },
          { id: 'v-q-pool', key: 'e', name: 'Pool', damage: [magic(20)] },
        ],
      },
    },
  }
}

const dummy = (startHpFraction = 1) => ({ ...combatantFromDummy({ kind: 'dummy', hp: 1000, armor: 0, mr: 0 }), startHpFraction })
const attacker = () => combatantFromChampion(champion(), 15, { items: [], runes: [], inputs: {} }, { items: new Map(), runes: new Map() })

describe('ability variants', () => {
  it('a plain cast uses the first variant; Q:w casts the variant keyed w, with its own cast time', () => {
    expect(simulateCombo(attacker(), dummy(), ['Q']).instances.map((i) => [i.source.id, i.raw])).toEqual([['v-q-fire', 100]])
    const bolt = simulateCombo(attacker(), dummy(), ['Q:w']).instances[0]
    expect([bolt.source.id, bolt.source.name, bolt.raw, bolt.time]).toEqual(['v-q-bolt', 'Bolt', 80, 0.5])
  })

  it('the variants share one cooldown', () => {
    const result = simulateCombo(attacker(), dummy(), ['Q:q', 'Q:w', 'Q:e'])
    expect(result.instances.map((i) => i.source.id)).toEqual(['v-q-fire'])
  })

  it('an unknown variant is skipped with a warning', () => {
    const result = simulateCombo(attacker(), dummy(), ['W:q'])
    expect(result.instances).toEqual([])
    expect(result.dataWarnings.some((warning) => /no variant 'q'/.test(warning))).toBe(true)
  })

  it('an abilityVariant condition limits an effect to that variant', () => {
    const empowered = (cast: 'Q:q' | 'Q:w') => simulateCombo(attacker(), dummy(), [cast, 'AA'], { ignoreCooldowns: true })
      .instances.some((i) => i.source.id === 'v-empower')
    expect(empowered('Q:w')).toBe(true)
    expect(empowered('Q:q')).toBe(false)
  })

  it('targetMissingHpFraction scales a ratio by the share of Health missing', () => {
    const bolt = simulateCombo(attacker(), dummy(0.25), ['Q:w']).instances[0]
    expect(bolt.raw).toBeCloseTo(80 + 200 * 0.75, 6)
  })
})
