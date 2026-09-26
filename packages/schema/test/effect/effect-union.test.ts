import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const EXPECTED_KINDS = [
  'stat', 'statMultiplier', 'statConversion', 'stacking', 'onHit', 'spellblade',
  'procEveryN', 'dot', 'resistShred', 'penetration', 'damageAmp', 'cooldownRefund',
  'damageReduction', 'shield', 'heal', 'active', 'abilityHitProc', 'damageWindowProc', 'custom',
]

describe('EffectSchema union', () => {
  it('recognizes exactly the 19 documented kinds', () => {
    const optionKinds = EffectSchema.options.map((option) => option.shape.kind.value)
    expect(optionKinds.sort()).toEqual([...EXPECTED_KINDS].sort())
  })
})
