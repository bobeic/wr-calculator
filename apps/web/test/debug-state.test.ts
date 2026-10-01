import { describe, it, expect } from 'vitest'
import { buildCatalog } from '@wr-calc/data'
import { defaultState, emptyBuild } from '../src/lib/debug-state'
import { datasetFor } from '../src/lib/dataset'

describe('defaultState', () => {
  it('uses the first champion at max level, empty builds and the first preset', () => {
    expect(defaultState(datasetFor('7.3'))).toEqual({
      championId: 'aatrox',
      level: 15,
      abilityRanks: {},
      buildA: { items: [], runes: [], inputs: {} },
      buildB: { items: [], runes: [], inputs: {} },
      target: { kind: 'preset', presetId: 'squishy' },
      combo: 'AA',
      priority: 'Q W E R',
      durationSeconds: 10,
      critMode: 'expected',
    })
  })

  it('throws on a dataset with no champions or no presets', () => {
    const empty = { champions: new Map(), catalog: buildCatalog([]), targets: [] }
    expect(() => defaultState(empty)).toThrow(/at least one champion and one target preset/)
  })
})

describe('emptyBuild', () => {
  it('returns a fresh object each call', () => {
    const first = emptyBuild()
    first.items.push('long-sword')
    expect(emptyBuild().items).toEqual([])
  })
})

describe("datasetFor('7.3')", () => {
  it('wires the real patch 7.3 champions, items and presets', () => {
    expect(datasetFor('7.3').champions.has('jinx')).toBe(true)
    expect(datasetFor('7.3').catalog.items.has('trinity-force')).toBe(true)
    expect(datasetFor('7.3').targets.map((preset) => preset.id)).toEqual(['squishy', 'bruiser', 'tank'])
  })
})
