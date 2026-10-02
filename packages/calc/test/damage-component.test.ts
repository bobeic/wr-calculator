import { describe, it, expect } from 'vitest'
import { resolveDamageComponent } from '../src/damage-component'
import type { Combatant } from '../src/combatant'
import type { StatSheet } from '../src/resolve-stats'
import type { DamageComponent } from '@wr-calc/schema'

function sheet(overrides: Partial<StatSheet> = {}): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [], ...overrides,
  }
}

function combatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c1', name: 'Test', kind: 'champion', level: 5, sheet: sheet(), items: [],
    runeEffects: [], inputs: {}, startHpFraction: 1, ...overrides,
  }
}

describe('resolveDamageComponent', () => {
  it('resolves base plus a totalAd ratio', () => {
    const attacker = combatant({ sheet: sheet({ total: { ad: 100 } }) })
    const target = combatant()
    const component = {
      type: 'physical' as const, base: 20,
      ratios: [{ stat: 'totalAd' as const, value: 0.5 }], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 1000, 5, 'Test Q')
    expect(result).toEqual({ type: 'physical', amount: 70, dataWarnings: [] })
  })

  it('sums multiple ratios', () => {
    const attacker = combatant({ sheet: sheet({ total: { ad: 100, ap: 50 } }) })
    const target = combatant()
    const component = {
      type: 'magic' as const, base: 0,
      ratios: [
        { stat: 'totalAd' as const, value: 0.2 }, { stat: 'ap' as const, value: 0.6 },
      ], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 1000, 5, 'Test W')
    expect(result.amount).toBe(50)
  })

  it('resolves byRank base and ratio values at the given ability rank', () => {
    const attacker = combatant({ sheet: sheet({ total: { ap: 100 } }) })
    const target = combatant()
    const component = {
      type: 'magic' as const, base: { byRank: [80, 120, 160] },
      ratios: [{ stat: 'ap' as const, value: { byRank: [0.4, 0.5, 0.6] } }], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 1000, 5, 'Test Q', 3)
    expect(result.amount).toBeCloseTo(160 + 100 * 0.6)
    expect(result.dataWarnings).toEqual([])
  })

  it('multiplies by hits when present', () => {
    const attacker = combatant()
    const target = combatant()
    const component = { type: 'physical' as const, base: 10, ratios: [], hits: 3, tags: [] }
    const result = resolveDamageComponent(component, attacker, target, 1000, 5, 'Test E')
    expect(result.amount).toBe(30)
  })

  it('uses the live target current hp, not the target sheet total', () => {
    const attacker = combatant()
    const target = combatant({ sheet: sheet({ total: { hp: 2000 } }) })
    const component = {
      type: 'true' as const, base: 0,
      ratios: [{ stat: 'targetCurrentHp' as const, value: 0.1 }], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 400, 5, 'Test R')
    expect(result.amount).toBe(40)
  })

  it('computes targetMissingHp from the sheet max minus live current', () => {
    const attacker = combatant()
    const target = combatant({ sheet: sheet({ total: { hp: 1000 } }) })
    const component = {
      type: 'true' as const, base: 0,
      ratios: [{ stat: 'targetMissingHp' as const, value: 0.5 }], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 300, 5, 'Test R')
    expect(result.amount).toBe(350)
  })

  it('collects data warnings for null base and ratio values', () => {
    const attacker = combatant()
    const target = combatant()
    const component = {
      type: 'physical' as const, base: null,
      ratios: [{ stat: 'totalAd' as const, value: null }], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 1000, 5, 'Test Q')
    expect(result.dataWarnings).toEqual([
      'Test Q: base is unverified (null)',
      'Test Q: ratios.totalAd is unverified (null)',
    ])
  })

  it('grows a ratio coefficient with a second stat (perStat)', () => {
    const attacker = combatant({
      level: 15,
      sheet: sheet({ base: { ad: 100 }, bonus: { ad: 40 }, total: { ad: 140 } }),
    })
    const target = combatant({ level: 15, sheet: sheet({ total: { hp: 10000 } }) })
    const component: DamageComponent = {
      type: 'physical', base: 120, tags: [],
      ratios: [{ stat: 'targetMaxHp', value: 0.07, perStat: { stat: 'bonusAd', value: 0.0004 } }],
    }
    const result = resolveDamageComponent(component, attacker, target, 10000, 15, 'Test Q')
    expect(result.amount).toBeCloseTo(120 + (0.07 + 0.0004 * 40) * 10000, 10)
  })

  it('warns and uses only the base coefficient when perStat.value is null', () => {
    const attacker = combatant({
      level: 15,
      sheet: sheet({ bonus: { ad: 40 } }),
    })
    const target = combatant({ level: 15, sheet: sheet({ total: { hp: 10000 } }) })
    const component: DamageComponent = {
      type: 'physical', base: 0, tags: [],
      ratios: [{ stat: 'targetMaxHp', value: 0.07, perStat: { stat: 'bonusAd', value: null } }],
    }
    const result = resolveDamageComponent(component, attacker, target, 10000, 15, 'Test Q')
    expect(result.amount).toBeCloseTo(700, 10)
    expect(result.dataWarnings).toContain(
      'Test Q: ratios.targetMaxHp.perStat.bonusAd is unverified (null)'
    )
  })
})

describe('resolveDamageComponent perInput', () => {
  it("adds perInput.value × the attacker's number input to the coefficient", () => {
    const component: DamageComponent = {
      type: 'magic', base: 0, tags: [],
      ratios: [{ stat: 'targetMaxHp', value: 0.03, perInput: { inputId: 'feast', value: 0.006 } }],
    }
    const target = combatant({ sheet: sheet({ total: { hp: 2000 } }) })
    const withStacks = resolveDamageComponent(component, combatant({ inputs: { feast: 5 } }), target, 2000, 15, 'Spikes')
    expect(withStacks.amount).toBeCloseTo(2000 * (0.03 + 0.03), 6)
    const without = resolveDamageComponent(component, combatant(), target, 2000, 15, 'Spikes')
    expect(without.amount).toBeCloseTo(60, 6)
  })
})

describe('resolveDamageComponent basePerInput', () => {
  it("adds basePerInput.value × the attacker's number input to the base", () => {
    const component: DamageComponent = { type: 'physical', base: 20, ratios: [], basePerInput: { inputId: 'stacks', value: 1 }, tags: [] }
    const target = combatant()
    expect(resolveDamageComponent(component, combatant({ inputs: { stacks: 150 } }), target, 1000, 15, 'Q').amount).toBe(170)
    expect(resolveDamageComponent(component, combatant(), target, 1000, 15, 'Q').amount).toBe(20)
  })
})

describe('resolveDamageComponent owner resist ratios', () => {
  it('reads total Armor, bonus Armor and bonus Magic Resist from the attacker', () => {
    const attacker = combatant({ sheet: sheet({ total: { armor: 150, mr: 90 }, bonus: { armor: 100, mr: 50 } }) })
    const component: DamageComponent = {
      type: 'physical', base: 0, tags: [],
      ratios: [{ stat: 'armor', value: 1 }, { stat: 'bonusArmor', value: 0.1 }, { stat: 'bonusMr', value: 0.01 }],
    }
    expect(resolveDamageComponent(component, attacker, combatant(), 1000, 15, 'X').amount).toBeCloseTo(150 + 10 + 0.5, 6)
  })
})
