import { describe, it, expect } from 'vitest'
import { statHandler } from '../../src/effects/stat'
import type { StatContext } from '../../src/effects/types'

function ctx(overrides: Partial<StatContext> = {}): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0, ...overrides }
}

describe('statHandler', () => {
  it('contributes a flat amount to the bonus layer', () => {
    const effect = {
      id: 'e1', name: 'Test Passive', description: '', support: 'full' as const,
      kind: 'stat' as const, stat: 'ad' as const, amount: 10,
    }
    const [contribution] = statHandler.contributeStats!(effect, ctx())
    expect(contribution).toEqual({
      stat: 'ad', layer: 'bonus', amount: 10,
      source: { kind: 'effect', id: 'e1', name: 'Test Passive' },
      dataWarning: undefined, usedLevelRangeInterpolation: false,
    })
  })

  it('flags a data warning when amount is null', () => {
    const effect = {
      id: 'e1', name: 'Test Passive', description: '', support: 'full' as const,
      kind: 'stat' as const, stat: 'ad' as const, amount: null,
    }
    const [contribution] = statHandler.contributeStats!(effect, ctx())
    expect(contribution.amount).toBe(0)
    expect(contribution.dataWarning).toBe('Test Passive: amount is unverified (null)')
  })
})
