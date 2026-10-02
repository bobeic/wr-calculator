import { describe, it, expect } from 'vitest'
import type { Effect } from '@wr-calc/schema'
import { effectForAttackType } from '../src/attack-type'

const effect: Effect = {
  kind: 'stat', id: 's', name: 'S', description: '', support: 'full', stat: 'attackSpeed', amount: 0.3, ranged: { amount: 0.2 },
}

describe('effectForAttackType', () => {
  it('takes the ranged values for a ranged owner and drops the ranged block either way', () => {
    expect(effectForAttackType(effect, 'ranged')).toEqual({ ...effect, amount: 0.2, ranged: undefined } as unknown as Effect)
    expect(effectForAttackType(effect, 'ranged')).not.toHaveProperty('ranged')
    expect(effectForAttackType(effect, 'melee')).not.toHaveProperty('ranged')
    expect((effectForAttackType(effect, 'melee') as { amount: number }).amount).toBe(0.3)
  })

  it('returns an effect without ranged values unchanged', () => {
    const plain: Effect = { ...effect, ranged: undefined }
    delete (plain as { ranged?: unknown }).ranged
    expect(effectForAttackType(plain, 'ranged')).toBe(plain)
  })
})
