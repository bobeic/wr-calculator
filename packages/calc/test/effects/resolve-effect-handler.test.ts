import { describe, it, expect } from 'vitest'
import { resolveEffectHandler, EFFECT_HANDLERS } from '../../src/effects/registry'
import { CUSTOM_HANDLERS } from '../../src/custom/registry'
import type { EffectHandler } from '../../src/effects/types'

describe('CUSTOM_HANDLERS', () => {
  it('holds the item handlers that need code: Guinsoo\'s phantom hit and Fiendhunter\'s Opening Barrage', () => {
    expect(Object.keys(CUSTOM_HANDLERS).sort()).toEqual(['fiendhunter-opening-barrage', 'guinsoos-phantom-hit'])
  })
})

describe('resolveEffectHandler', () => {
  it('dispatches non-custom kinds straight to EFFECT_HANDLERS', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'stat' as const, stat: 'ad' as const, amount: 10,
    }
    expect(resolveEffectHandler(effect)).toBe(EFFECT_HANDLERS.stat)
  })

  it('resolves a custom effect from a caller-supplied override', () => {
    const fakeHandler: EffectHandler = { kind: 'custom' }
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'custom' as const, handler: 'fake-handler',
    }
    expect(resolveEffectHandler(effect, { 'fake-handler': fakeHandler })).toBe(fakeHandler)
  })

  it('returns undefined for an unregistered custom handler id', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'custom' as const, handler: 'does-not-exist',
    }
    expect(resolveEffectHandler(effect)).toBeUndefined()
  })
})
