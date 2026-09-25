import { describe, it, expect } from 'vitest'
import {
  MAX_CHAMPION_LEVEL, statAtLevel, interpolateLevelRange, resolveAdaptiveDamageType,
  attackSpeedAtLevel, totalAttackSpeed, STAT_RESOLUTION_ORDER, UNVERIFIED_RULE_IDS, critMultiplier,
  HAS_SEPARATE_ENCHANT_SLOT,
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

  // Annie's HP and mana at every level, read off the 7.3 practice-tool stat screen (2026-09-25). The
  // stat screen rounds up, so each value is the ceiling of the unrounded engine value.
  const ANNIE_HP = [600, 689, 783, 881, 984, 1092, 1205, 1323, 1445, 1572, 1704, 1841, 1983, 2129, 2280]
  const ANNIE_MANA = [435, 478, 522, 569, 618, 669, 723, 779, 837, 897, 960, 1025, 1092, 1162, 1233]

  it('matches Annie\'s in-game HP at every level (rounded up)', () => {
    ANNIE_HP.forEach((hp, index) => expect(Math.ceil(statAtLevel(600, 120, index + 1))).toBe(hp))
  })

  it('matches Annie\'s in-game mana at every level (rounded up)', () => {
    ANNIE_MANA.forEach((mana, index) => expect(Math.ceil(statAtLevel(435, 57, index + 1))).toBe(mana))
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

describe('attackSpeedAtLevel', () => {
  it('returns base at level 1', () => {
    expect(attackSpeedAtLevel(0.625, 0.025, 1)).toBe(0.625)
  })

  it('returns base with zero growth when ratio is 0', () => {
    expect(attackSpeedAtLevel(0.625, 0, MAX_CHAMPION_LEVEL)).toBe(0.625)
  })

  it('grows with level when ratio is positive', () => {
    const level1 = attackSpeedAtLevel(0.625, 0.025, 1)
    const maxLevel = attackSpeedAtLevel(0.625, 0.025, MAX_CHAMPION_LEVEL)
    expect(maxLevel).toBeGreaterThan(level1)
  })

  it('uses the same growth curve as other stats', () => {
    for (let level = 1; level <= MAX_CHAMPION_LEVEL; level++) {
      expect(attackSpeedAtLevel(0.625, 0.025, level)).toBeCloseTo(
        0.625 * (1 + 0.025 * (statAtLevel(0, 1, level))), 10
      )
    }
  })

  it('grows non-linearly: late-level increments exceed early-level increments', () => {
    const early = attackSpeedAtLevel(0.625, 0.025, 2) - attackSpeedAtLevel(0.625, 0.025, 1)
    const late = attackSpeedAtLevel(0.625, 0.025, MAX_CHAMPION_LEVEL)
      - attackSpeedAtLevel(0.625, 0.025, MAX_CHAMPION_LEVEL - 1)
    expect(late).toBeGreaterThan(early)
  })
})

describe('totalAttackSpeed', () => {
  it('combines base and a fractional bonus multiplicatively', () => {
    expect(totalAttackSpeed(0.625, 0.25)).toBeCloseTo(0.78125, 10)
  })

  it('returns base unchanged when the bonus fraction is 0', () => {
    expect(totalAttackSpeed(0.625, 0)).toBe(0.625)
  })
})

describe('STAT_RESOLUTION_ORDER', () => {
  it('defines the three effect-driven stat resolution stages in order', () => {
    expect(STAT_RESOLUTION_ORDER).toEqual(['flat', 'multiplier', 'conversion'])
  })
})

describe('UNVERIFIED_RULE_IDS', () => {
  it('is non-empty and has no duplicates', () => {
    expect(UNVERIFIED_RULE_IDS.length).toBeGreaterThan(0)
    expect(new Set(UNVERIFIED_RULE_IDS).size).toBe(UNVERIFIED_RULE_IDS.length)
  })
})

describe('critMultiplier', () => {
  it('is 1 in "never" mode', () => {
    expect(critMultiplier(0.5, 0.2, 'never')).toBe(1)
  })

  it('is the full crit multiplier in "always" mode', () => {
    expect(critMultiplier(0.5, 0.2, 'always')).toBeCloseTo(2.2)
  })

  it('has a 200% base, so Infinity Edge (+30%) crits for 230%', () => {
    expect(critMultiplier(1, 0, 'always')).toBeCloseTo(2)
    expect(critMultiplier(1, 0.3, 'always')).toBeCloseTo(2.3)
  })

  it('is an expected value between 1 and the full multiplier in "expected" mode', () => {
    const result = critMultiplier(0.5, 0, 'expected')
    expect(result).toBeCloseTo(1 + 0.5 * 1)
  })

  it('clamps crit chance to [0, 1] in "expected" mode', () => {
    expect(critMultiplier(2, 0, 'expected')).toBe(critMultiplier(1, 0, 'expected'))
    expect(critMultiplier(-1, 0, 'expected')).toBe(1)
  })
})

describe('HAS_SEPARATE_ENCHANT_SLOT', () => {
  it('is false: Wild Rift removed the boot-enchant mechanic, enchants are standalone items now', () => {
    expect(HAS_SEPARATE_ENCHANT_SLOT).toBe(false)
  })
})
