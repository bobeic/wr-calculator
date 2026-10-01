import { describe, it, expect } from 'vitest'
import { CURRENT_PATCH, PATCH_IDS, getPatchDataset } from '../src/patches/registry'
import { PATCH_7_3_CHAMPIONS, PATCH_7_3_ITEMS, PATCH_7_3_TARGETS } from '../src/patches/7.3'

describe('patch registry', () => {
  it('current patch is the last registered id', () => {
    expect(CURRENT_PATCH).toBe(PATCH_IDS[PATCH_IDS.length - 1])
    expect(PATCH_IDS[0]).toBe('7.3')
  })

  it('the 7.3 dataset equals the legacy PATCH_7_3 exports', () => {
    const dataset = getPatchDataset('7.3')
    expect(dataset.items).toEqual(PATCH_7_3_ITEMS)
    expect(dataset.champions).toEqual(PATCH_7_3_CHAMPIONS)
    expect(dataset.targets).toEqual(PATCH_7_3_TARGETS)
    expect([...dataset.catalog.items.keys()]).toEqual(PATCH_7_3_ITEMS.map((item) => item.id))
  })

  it('every registered patch builds', () => {
    for (const id of PATCH_IDS) expect(getPatchDataset(id).id).toBe(id)
  })

  it('7.3a has every flagged entry reviewed or overridden, with the Death\'s Dance price rise', () => {
    const dataset = getPatchDataset('7.3a')
    expect([...dataset.stale.items.keys(), ...dataset.stale.champions.keys()]).toEqual([])
    const deathsDance = dataset.items.find((item) => item.id === 'deaths-dance')
    expect(deathsDance?.cost).toEqual({ total: 3300, combine: 400 })
    expect(deathsDance?.provenance.patch).toBe('7.3a')
  })

  it('throws for an unknown patch, naming the known ones', () => {
    expect(() => getPatchDataset('6.0')).toThrow("unknown patch '6.0' (known: ")
  })
})
