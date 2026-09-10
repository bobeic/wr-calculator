import { describe, it, expect } from 'vitest'
import { StatKeySchema, STAT_KEYS } from '../src/stat-key'

describe('StatKeySchema', () => {
  it('accepts every declared stat key', () => {
    for (const key of STAT_KEYS) {
      expect(StatKeySchema.parse(key)).toBe(key)
    }
  })

  it('rejects an unknown stat key', () => {
    expect(() => StatKeySchema.parse('unknownStat')).toThrow()
  })
})
