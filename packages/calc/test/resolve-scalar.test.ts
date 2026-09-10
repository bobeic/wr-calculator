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

  it('returns undefined when nothing is wrong', () => {
    const resolved = resolveScalar(10, 5)
    expect(scalarWarning('Test Effect', 'amount', resolved)).toBeUndefined()
  })
})
