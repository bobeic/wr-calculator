import { describe, it, expect } from 'vitest'
import { TargetDummySchema } from '@wr-calc/schema'
import { PATCH_7_3_TARGETS } from '../src'

describe('PATCH_7_3_TARGETS', () => {
  it('has the squishy, bruiser and tank presets in that order', () => {
    expect(PATCH_7_3_TARGETS.map((preset) => preset.id)).toEqual(['squishy', 'bruiser', 'tank'])
  })

  it('every preset target parses against TargetDummySchema', () => {
    for (const preset of PATCH_7_3_TARGETS) {
      expect(() => TargetDummySchema.parse(preset.target), preset.id).not.toThrow()
    }
  })

  it('every preset is marked unverified for patch 7.3', () => {
    for (const preset of PATCH_7_3_TARGETS) {
      expect(preset.provenance, preset.id).toEqual({
        source: 'manual', patch: '7.3', verifiedInGame: false,
      })
    }
  })

  it('presets get tankier in order', () => {
    const [squishy, bruiser, tank] = PATCH_7_3_TARGETS.map((preset) => preset.target)
    expect(squishy.hp).toBeLessThan(bruiser.hp)
    expect(bruiser.hp).toBeLessThan(tank.hp)
    expect(squishy.armor).toBeLessThan(tank.armor)
    expect(squishy.mr).toBeLessThan(tank.mr)
  })
})
