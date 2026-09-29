import { describe, it, expect } from 'vitest'
import { statConversionHandler } from '../../src/effects/stat-conversion'
import type { StatContext } from '../../src/effects/types'

function ctx(overrides: Partial<StatContext> = {}): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0, ...overrides }
}

describe('statConversionHandler', () => {
  it('converts a ratio of the fromStat total into the toStat', () => {
    const effect = {
      id: 'e1', name: 'Test Conversion', description: '', support: 'full' as const,
      kind: 'statConversion' as const, fromStat: 'ap' as const, toStat: 'ad' as const, ratio: 0.3,
    }
    const statSoFar: StatContext['statSoFar'] = (stat, layer) =>
      (stat === 'ap' && layer === 'total' ? 100 : 0)
    const [contribution] = statConversionHandler.contributeStats!(effect, ctx({ statSoFar }))
    expect(contribution.stat).toBe('ad')
    expect(contribution.amount).toBe(30)
  })

  it('converts from the bonus layer when fromLayer is bonus', () => {
    const effect = {
      id: 'e1', name: 'Test Conversion', description: '', support: 'full' as const,
      kind: 'statConversion' as const, fromStat: 'hp' as const, fromLayer: 'bonus' as const,
      toStat: 'ap' as const, ratio: 0.02,
    }
    const statSoFar: StatContext['statSoFar'] = (stat, layer) => {
      if (stat !== 'hp') return 0
      return layer === 'bonus' ? 350 : layer === 'total' ? 2630 : 2280
    }
    const [contribution] = statConversionHandler.contributeStats!(effect, ctx({ statSoFar }))
    expect(contribution.amount).toBeCloseTo(7, 10)
  })

  it('flags a data warning when ratio is null', () => {
    const effect = {
      id: 'e1', name: 'Test Conversion', description: '', support: 'full' as const,
      kind: 'statConversion' as const, fromStat: 'ap' as const, toStat: 'ad' as const, ratio: null,
    }
    const [contribution] = statConversionHandler.contributeStats!(effect, ctx())
    expect(contribution.dataWarning).toBe('Test Conversion: ratio is unverified (null)')
  })
})
