import { describe, it, expect } from 'vitest'
import { stackingHandler } from '../../src/effects/stacking'
import type { StatContext } from '../../src/effects/types'

function ctx(overrides: Partial<StatContext> = {}): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0, ...overrides }
}

const effect = {
  id: 'e1', name: 'Test Stacks', description: '', support: 'full' as const,
  kind: 'stacking' as const, stat: 'ad' as const, perStack: 2, maxStacks: 5,
  stackInputId: 'stacks',
}

describe('stackingHandler', () => {
  it('multiplies perStack by the current stack count from inputs', () => {
    const [contribution] = stackingHandler.contributeStats!(effect, ctx({ inputs: { stacks: 3 } }))
    expect(contribution.amount).toBe(6)
  })

  it('caps stacks at maxStacks', () => {
    const [contribution] = stackingHandler.contributeStats!(effect, ctx({ inputs: { stacks: 99 } }))
    expect(contribution.amount).toBe(10)
  })

  it('treats a missing input as zero stacks', () => {
    const [contribution] = stackingHandler.contributeStats!(effect, ctx({ inputs: {} }))
    expect(contribution.amount).toBe(0)
  })

  it('flags a data warning when perStack is null', () => {
    const [contribution] = stackingHandler.contributeStats!(
      { ...effect, perStack: null }, ctx({ inputs: { stacks: 3 } })
    )
    expect(contribution.dataWarning).toBe('Test Stacks: perStack is unverified (null)')
  })

  it('clamps negative stack counts to zero', () => {
    const [contribution] = stackingHandler.contributeStats!(effect, ctx({ inputs: { stacks: -5 } }))
    expect(contribution.amount).toBe(0)
  })
})
