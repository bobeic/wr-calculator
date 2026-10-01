import { describe, it, expect } from 'vitest'
import type { Champion, Item } from '@wr-calc/schema'
import { buildPatchDataset, buildPatchDatasets } from '../src/patches/overlay'
import type { PatchLayer } from '../src/patches/overlay'

const PROV = { source: 'wiki' as const, patch: '7.3', verifiedInGame: true }
const item = (id: string, ad = 10): Item => ({
  id, name: id, tier: 'legendary', cost: { total: 1, combine: 1 }, recipe: [], stats: { ad }, effects: [], tags: [], provenance: PROV,
})
const champion = { id: 'ambessa', name: 'Ambessa', provenance: PROV } as unknown as Champion
const NO_CHANGES = { items: [], champions: [] }

const root: PatchLayer = {
  id: '7.3', generatedItems: [item('hand', 1), item('plain'), item('grouped')], generatedChampions: [],
  overrideItems: [item('hand', 99)], overrideChampions: [champion], reviewed: [], changedIds: NO_CHANGES,
  exclusiveGroups: { grouped: 'g' }, targets: [],
}
const next = (overrides: Partial<PatchLayer>): PatchLayer => ({
  id: '7.3a', generatedItems: [item('hand', 2), item('plain'), item('grouped')], generatedChampions: [],
  overrideItems: [], overrideChampions: [], reviewed: [], changedIds: NO_CHANGES, ...overrides,
})

describe('buildPatchDataset', () => {
  const base = buildPatchDataset(root, null)

  it('root: hand-modelled entries replace generated ones, groups applied, nothing stale', () => {
    expect(base.items.find((entry) => entry.id === 'hand')?.stats.ad).toBe(99)
    expect(base.items.find((entry) => entry.id === 'grouped')?.exclusiveGroup).toBe('g')
    expect(base.stale.items.size).toBe(0)
  })

  it('throws for a root layer without groups or targets', () => {
    expect(() => buildPatchDataset({ ...root, exclusiveGroups: undefined }, null)).toThrow(/root patch 7.3/)
  })

  it('inherits hand-modelled entries and marks changed ones stale', () => {
    const dataset = buildPatchDataset(next({ changedIds: { items: ['hand', 'plain'], champions: ['ambessa'] } }), base)
    const hand = dataset.items.find((entry) => entry.id === 'hand')
    expect(hand?.stats.ad).toBe(99)
    expect(hand?.provenance).toEqual({ ...PROV, verifiedInGame: false, staleSince: '7.3a' })
    expect(dataset.items.find((entry) => entry.id === 'plain')?.provenance).toEqual(PROV)
    expect(dataset.champions.find((entry) => entry.id === 'ambessa')?.provenance.staleSince).toBe('7.3a')
    expect(dataset.handModelled.items.find((entry) => entry.id === 'hand')?.provenance).toEqual(PROV)
  })

  it('does not mark overridden or reviewed entries stale', () => {
    const dataset = buildPatchDataset(next({
      changedIds: { items: ['hand'], champions: ['ambessa'] },
      overrideItems: [item('hand', 50)],
      reviewed: [{ kind: 'champion', id: 'ambessa', note: 'wording only' }],
    }), base)
    expect(dataset.items.find((entry) => entry.id === 'hand')).toEqual(item('hand', 50))
    expect(dataset.stale.items.size + dataset.stale.champions.size).toBe(0)
  })

  it('carries staleness forward with its original patch until covered', () => {
    const a = buildPatchDataset(next({ changedIds: { items: ['hand'], champions: [] } }), base)
    const b = buildPatchDataset({ ...next({}), id: '7.3b' }, a)
    expect(b.stale.items.get('hand')).toBe('7.3a')
    const c = buildPatchDataset({ ...next({ reviewed: [{ kind: 'item', id: 'hand', note: 'checked' }] }), id: '7.3c' }, b)
    expect(c.stale.items.size).toBe(0)
    expect(c.items.find((entry) => entry.id === 'hand')?.provenance).toEqual(PROV)
  })

  it('keeps a hand-modelled entry that wrpocket removed, marked stale', () => {
    const dataset = buildPatchDataset(next({
      generatedItems: [item('plain'), item('grouped')], changedIds: { items: ['hand'], champions: [] },
    }), base)
    expect(dataset.items.find((entry) => entry.id === 'hand')?.provenance.staleSince).toBe('7.3a')
  })

  it('drops inherited exclusive-group ids that no longer exist instead of throwing', () => {
    const dataset = buildPatchDataset(next({ generatedItems: [item('hand'), item('plain')] }), base)
    expect(dataset.exclusiveGroups).toEqual({})
  })

  it('buildPatchDatasets chains layers in order', () => {
    const datasets = buildPatchDatasets([root, next({ changedIds: { items: ['hand'], champions: [] } })])
    expect([...datasets.keys()]).toEqual(['7.3', '7.3a'])
    expect(datasets.get('7.3a')?.stale.items.get('hand')).toBe('7.3a')
  })
})
