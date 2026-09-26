import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const base = {
  id: 'test-effect',
  name: 'Test Effect',
  description: 'Test description',
  support: 'full' as const,
}

describe('on-hit-family effect kinds', () => {
  it('parses an onHit effect with flat and pct-current-hp damage', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'onHit',
      damageType: 'physical',
      flat: 15,
      pctTargetCurrentHp: 0.08,
      monsterCap: 60,
    })
    expect(result.kind).toBe('onHit')
  })

  it('parses an abilityHitProc effect with ratios and a start-on-cooldown input', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'abilityHitProc',
      damageType: 'magic',
      damage: 175,
      ratios: [{ stat: 'ap', value: 0.14 }],
      cooldownSeconds: 9,
      startOnCooldownInputId: 'test-on-cooldown',
    })
    expect(result.kind).toBe('abilityHitProc')
  })

  it('defaults abilityHitProc ratios to an empty list', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'abilityHitProc', damageType: 'magic', damage: 50, cooldownSeconds: 5,
    })
    expect(result.kind === 'abilityHitProc' && result.ratios).toEqual([])
  })

  it('parses a spellblade effect', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'spellblade',
      damageType: 'physical',
      bonusDamage: null,
      ratios: [{ stat: 'ad', value: 1 }],
      internalCooldownSeconds: 1.5,
    })
    expect(result.kind).toBe('spellblade')
  })

  it('rejects an unknown field inside a spellblade ratio entry', () => {
    expect(() =>
      EffectSchema.parse({
        ...base,
        kind: 'spellblade',
        damageType: 'physical',
        bonusDamage: null,
        ratios: [{ stat: 'ad', value: 1, madeUpField: true }],
        internalCooldownSeconds: 1.5,
      })
    ).toThrow()
  })

  it('rejects an unknown field inside onHit.pctOwnStat', () => {
    expect(() =>
      EffectSchema.parse({
        ...base,
        kind: 'onHit',
        damageType: 'physical',
        pctOwnStat: { stat: 'ad', ratio: 0.5, madeUpField: true },
      })
    ).toThrow()
  })

  it('parses a procEveryN effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'procEveryN', n: 3, damageType: 'magic', damage: 40,
    })
    expect(result.kind).toBe('procEveryN')
  })

  it('parses a dot effect', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'dot',
      damageType: 'magic',
      tickAmount: 10,
      tickIntervalSeconds: 1,
      durationSeconds: 4,
      refresh: 'refresh',
    })
    expect(result.kind).toBe('dot')
  })

  it('parses a dot effect with stat ratios and a flat shred while it is active', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'dot', damageType: 'magic', tickAmount: 60, tickIntervalSeconds: 1,
      durationSeconds: 3, refresh: 'refresh', ratios: [{ stat: 'ap', value: 0.05 }],
      shredWhileActive: { resist: 'mr', amount: 10 },
    })
    expect(result).toMatchObject({
      ratios: [{ stat: 'ap', value: 0.05 }], shredWhileActive: { resist: 'mr', amount: 10 },
    })
  })

  it('defaults a dot effect to no ratios', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'dot', damageType: 'magic', tickAmount: 10, tickIntervalSeconds: 1,
      durationSeconds: 4, refresh: 'refresh',
    })
    expect(result).toMatchObject({ ratios: [] })
  })

  it('rejects a dot effect with an invalid refresh rule', () => {
    expect(() =>
      EffectSchema.parse({
        ...base,
        kind: 'dot',
        damageType: 'magic',
        tickAmount: 10,
        tickIntervalSeconds: 1,
        durationSeconds: 4,
        refresh: 'explode',
      })
    ).toThrow()
  })
})
