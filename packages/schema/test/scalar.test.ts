import { describe, it, expect } from 'vitest'
import { ScalarSchema, NullableScalarSchema } from '../src/scalar'

describe('ScalarSchema', () => {
  it('accepts a plain number', () => {
    expect(ScalarSchema.parse(10)).toBe(10)
  })

  it('accepts a byLevel array', () => {
    const value = { byLevel: [1, 2, 3] }
    expect(ScalarSchema.parse(value)).toEqual(value)
  })

  it('accepts a levelRange object', () => {
    const value = { levelRange: { min: 10, max: 50 } }
    expect(ScalarSchema.parse(value)).toEqual(value)
  })

  it('accepts a byRank array', () => {
    const value = { byRank: [5, 10, 15, 20, 25] }
    expect(ScalarSchema.parse(value)).toEqual(value)
  })

  it('rejects a string', () => {
    expect(() => ScalarSchema.parse('10')).toThrow()
  })

  it('rejects null on the non-nullable schema', () => {
    expect(() => ScalarSchema.parse(null)).toThrow()
  })
})

describe('NullableScalarSchema', () => {
  it('accepts null', () => {
    expect(NullableScalarSchema.parse(null)).toBeNull()
  })

  it('accepts everything ScalarSchema accepts', () => {
    expect(NullableScalarSchema.parse(10)).toBe(10)
  })
})
