import { describe, it, expect } from 'vitest'
import {
  MAX_CHAMPION_LEVEL, statAtLevel, interpolateLevelRange, resolveAdaptiveDamageType,
  UNVERIFIED_RULE_IDS,
} from '../src/rules'

describe('statAtLevel', () => {
  it('returns base at level 1', () => {
    expect(statAtLevel(100, 10, 1)).toBe(100)
  })

  it('returns base + full linear growth at max level', () => {
    expect(statAtLevel(100, 10, MAX_CHAMPION_LEVEL)).toBeCloseTo(
      100 + 10 * (MAX_CHAMPION_LEVEL - 1), 5
    )
  })

  it('grows non-linearly: late-level increments exceed early-level increments', () => {
    const early = statAtLevel(100, 10, 2) - statAtLevel(100, 10, 1)
    const late = statAtLevel(100, 10, MAX_CHAMPION_LEVEL) - statAtLevel(100, 10, MAX_CHAMPION_LEVEL - 1)
    expect(late).toBeGreaterThan(early)
  })
})

describe('interpolateLevelRange', () => {
  it('returns min at level 1', () => {
    expect(interpolateLevelRange(10, 50, 1)).toBe(10)
  })

  it('returns max at max level', () => {
    expect(interpolateLevelRange(10, 50, MAX_CHAMPION_LEVEL)).toBe(50)
  })

  it('clamps levels above the cap', () => {
    expect(interpolateLevelRange(10, 50, 999)).toBe(50)
  })

  it('clamps levels below 1', () => {
    expect(interpolateLevelRange(10, 50, 0)).toBe(10)
  })
})

describe('resolveAdaptiveDamageType', () => {
  it('resolves to physical when bonus AD >= AP', () => {
    expect(resolveAdaptiveDamageType(50, 30)).toBe('physical')
  })

  it('resolves to magic when AP > bonus AD', () => {
    expect(resolveAdaptiveDamageType(30, 50)).toBe('magic')
  })
})

describe('UNVERIFIED_RULE_IDS', () => {
  it('is non-empty and has no duplicates', () => {
    expect(UNVERIFIED_RULE_IDS.length).toBeGreaterThan(0)
    expect(new Set(UNVERIFIED_RULE_IDS).size).toBe(UNVERIFIED_RULE_IDS.length)
  })
})
