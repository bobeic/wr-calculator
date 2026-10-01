import { describe, it, expect } from 'vitest'
import { sourceLabel } from '../src/lib/source-label'

const attack = { kind: 'basicAttack' as const, id: 'AA', name: 'Basic Attack' }

describe('sourceLabel', () => {
  it('names a plain instance by its source', () => {
    expect(sourceLabel({ time: 0, source: attack, type: 'physical', raw: 60, mitigated: 60, targetHpAfter: 0 }, String))
      .toBe('Basic Attack')
  })

  it('lists the parts of a merged instance', () => {
    expect(sourceLabel({
      time: 0, source: attack, type: 'physical', raw: 100, mitigated: 100, targetHpAfter: 0,
      parts: [{ source: attack, amount: 60 }, { source: { kind: 'passive', id: 'step', name: 'Step' }, amount: 40 }],
    }, String)).toBe('Basic Attack (Basic Attack 60 + Step 40)')
  })
})
