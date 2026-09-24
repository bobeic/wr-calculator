import { describe, it, expect } from 'vitest'
import { resolveScalar, scalarWarning } from '../src/resolve-scalar'

describe('resolveScalar', () => {
  it('resolves null to 0 and flags wasNull', () => {
    const result = resolveScalar(null, 5)
    expect(result).toEqual({
      value: 0, wasNull: true, usedLevelRangeInterpolation: false, wasByRank: false,
    })
  })

  it('resolves a plain number', () => {
    const result = resolveScalar(42, 5)
    expect(result.value).toBe(42)
    expect(result.wasNull).toBe(false)
  })

  it('resolves a levelRange scalar via interpolation', () => {
    const result = resolveScalar({ levelRange: { min: 10, max: 50 } }, 1)
    expect(result.value).toBe(10)
    expect(result.usedLevelRangeInterpolation).toBe(true)
  })

  it('resolves a byLevel scalar by indexing on champion level', () => {
    const result = resolveScalar({ byLevel: [1, 2, 3] }, 2)
    expect(result.value).toBe(2)
  })

  it('clamps byLevel indexing to the array bounds', () => {
    const result = resolveScalar({ byLevel: [1, 2, 3] }, 99)
    expect(result.value).toBe(3)
  })

  it('resolves a byRank scalar to 0 and flags wasByRank', () => {
    const result = resolveScalar({ byRank: [1, 2, 3] }, 5)
    expect(result.value).toBe(0)
    expect(result.wasByRank).toBe(true)
  })

  it('resolves a byRank scalar at the given ability rank', () => {
    const result = resolveScalar({ byRank: [10, 20, 30] }, 5, 2)
    expect(result).toEqual({
      value: 20, wasNull: false, usedLevelRangeInterpolation: false, wasByRank: true,
      rank: 2, byRankLength: 3,
    })
  })

  it('clamps a rank above the byRank array length to its last entry', () => {
    expect(resolveScalar({ byRank: [10, 20, 30] }, 5, 4).value).toBe(30)
  })

  it('clamps a rank below 1 to the first byRank entry', () => {
    expect(resolveScalar({ byRank: [10, 20, 30] }, 5, 0).value).toBe(10)
  })

  it('ignores the rank for non-byRank scalars', () => {
    expect(resolveScalar(42, 5, 3).value).toBe(42)
    expect(resolveScalar({ byLevel: [1, 2, 3] }, 2, 3).value).toBe(2)
  })

  it('resolves an empty byRank array to 0 and flags wasNull even with a rank', () => {
    const result = resolveScalar({ byRank: [] }, 5, 3)
    expect(result.value).toBe(0)
    expect(result.wasNull).toBe(true)
  })

  it('resolves an empty byLevel array to 0 and flags wasNull', () => {
    const result = resolveScalar({ byLevel: [] }, 5)
    expect(result).toEqual({
      value: 0, wasNull: true, usedLevelRangeInterpolation: false, wasByRank: false,
    })
  })
})

describe('scalarWarning', () => {
  it('returns a null-value warning', () => {
    const resolved = resolveScalar(null, 5)
    expect(scalarWarning('Test Effect', 'amount', resolved)).toBe(
      'Test Effect: amount is unverified (null)'
    )
  })

  it('returns a byRank warning', () => {
    const resolved = resolveScalar({ byRank: [1] }, 5)
    expect(scalarWarning('Test Effect', 'amount', resolved)).toBe(
      'Test Effect: amount uses a byRank scalar outside an ability-rank context; treated as 0'
    )
  })

  it('returns no warning for a byRank scalar whose length matches the rank', () => {
    const resolved = resolveScalar({ byRank: [1, 2, 3] }, 5, 3)
    expect(scalarWarning('Test Q', 'base', resolved)).toBeUndefined()
  })

  it('warns when a byRank array is longer than the rank it was resolved at', () => {
    const resolved = resolveScalar({ byRank: [1, 2, 3, 4, 5] }, 5, 4)
    expect(scalarWarning('Jayce W', 'base', resolved)).toBe(
      'Jayce W: base has 5 per-rank values but the ability is resolved at rank 4; used value 4'
    )
  })

  it('warns when a byRank array is shorter than the rank it was resolved at', () => {
    const resolved = resolveScalar({ byRank: [1, 2] }, 5, 3)
    expect(scalarWarning('Test Q', 'base', resolved)).toBe(
      'Test Q: base has 2 per-rank values but the ability is resolved at rank 3; used value 2'
    )
  })

  it('returns undefined when nothing is wrong', () => {
    const resolved = resolveScalar(10, 5)
    expect(scalarWarning('Test Effect', 'amount', resolved)).toBeUndefined()
  })

  it('returns a null-style warning for empty byLevel array', () => {
    const resolved = resolveScalar({ byLevel: [] }, 5)
    expect(scalarWarning('Test Effect', 'amount', resolved)).toBe(
      'Test Effect: amount is unverified (null)'
    )
  })
})
