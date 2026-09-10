import { describe, it, expect } from 'vitest'
import { statMultiplierHandler } from '../../src/effects/stat-multiplier'
import type { StatContext } from '../../src/effects/types'

function ctx(overrides: Partial<StatContext> = {}): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0, ...overrides }
}

describe('statMultiplierHandler', () => {
  it('multiplies the basis value read from the layer named on the effect', () => {
    const effect = {
      id: 'e1', name: 'Test Multiplier', description: '', support: 'full' as const,
      kind: 'statMultiplier' as const, stat: 'ad' as const, layer: 'bonus' as const, amount: 0.1,
    }
    const statSoFar: StatContext['statSoFar'] = (_stat, layer) => (layer === 'bonus' ? 50 : 0)
    const [contribution] = statMultiplierHandler.contributeStats!(effect, ctx({ statSoFar }))
    expect(contribution.amount).toBe(5)
    expect(contribution.layer).toBe('bonus')
  })

  it('reads the total layer when the effect targets total', () => {
    const effect = {
      id: 'e1', name: 'Test Multiplier', description: '', support: 'full' as const,
      kind: 'statMultiplier' as const, stat: 'ad' as const, layer: 'total' as const, amount: 0.2,
    }
    const statSoFar: StatContext['statSoFar'] = (_stat, layer) => (layer === 'total' ? 100 : 0)
    const [contribution] = statMultiplierHandler.contributeStats!(effect, ctx({ statSoFar }))
    expect(contribution.amount).toBe(20)
  })

  it('flags a data warning when amount is null', () => {
    const effect = {
      id: 'e1', name: 'Test Multiplier', description: '', support: 'full' as const,
      kind: 'statMultiplier' as const, stat: 'ad' as const, layer: 'bonus' as const, amount: null,
    }
    const [contribution] = statMultiplierHandler.contributeStats!(effect, ctx())
    expect(contribution.dataWarning).toBe('Test Multiplier: amount is unverified (null)')
  })
})
