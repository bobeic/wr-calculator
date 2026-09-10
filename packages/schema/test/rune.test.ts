import { describe, it, expect } from 'vitest'
import { RuneSchema } from '../src/rune'

describe('RuneSchema', () => {
  it('parses a minimal valid rune', () => {
    const result = RuneSchema.parse({
      id: 'conqueror', name: 'Conqueror', path: 'precision', slot: 'keystone', effects: [],
    })
    expect(result.id).toBe('conqueror')
  })

  it('rejects an unknown field', () => {
    expect(() =>
      RuneSchema.parse({
        id: 'conqueror', name: 'Conqueror', path: 'precision', slot: 'keystone', effects: [],
        madeUpField: true,
      })
    ).toThrow()
  })
})
