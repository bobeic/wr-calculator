import { describe, it, expect } from 'vitest'
import type { Champion, Item } from '@wr-calc/schema'
import { buildPatchDataset, buildPatchDatasets } from '../src/patches/overlay'
import type { PatchLayer } from '../src/patches/overlay'

const PROV = { source: 'wiki' as const, patch: '7.3', verifiedInGame: true }
const item = (id: string, ad = 10): Item => ({
  id, name: id, tier: 'legendary', cost: { total: 1, combine: 1 }, recipe: [], stats: { ad }, effects: [], tags: [], provenance: PROV,
})
// A hand-modelled item whose ad is pinned, so these tests see the hand value rather than the synced one.
const hand = (id: string, ad: number): Item => ({ ...item(id, ad), sourcePins: ['stats.ad'] })
const champion = { id: 'ambessa', name: 'Ambessa', provenance: PROV } as unknown as Champion
const NO_CHANGES = { items: [], champions: [] }

const root: PatchLayer = {
  id: '7.3', generatedItems: [item('hand', 1), item('plain'), item('grouped')], generatedChampions: [],
  overrideItems: [hand('hand', 99)], overrideChampions: [champion], reviewed: [], changedIds: NO_CHANGES,
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
      overrideItems: [hand('hand', 50)],
      reviewed: [{ kind: 'champion', id: 'ambessa', note: 'wording only' }],
    }), base)
    expect(dataset.items.find((entry) => entry.id === 'hand')).toEqual(hand('hand', 50))
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

describe('source sync of hand-modelled items', () => {
  const effect = { kind: 'statMultiplier', id: 'x', name: 'X', description: '', support: 'full', stat: 'ap', layer: 'total', amount: 0.3 } as unknown as Item['effects'][number]
  const handItem: Item = {
    ...item('hand', 1), name: 'Old', cost: { total: 3200, combine: 400 }, recipe: ['a'],
    stats: { ad: 1, critDamage: 0.3 }, effects: [effect], tags: ['physical'],
  }
  const generated: Item = {
    ...item('hand', 2), name: 'New', cost: { total: 3300, combine: 500 }, recipe: ['a', 'b'], stats: { ad: 2, armor: 5 },
  }
  const layer = (overrides: Item[]): PatchLayer => ({
    id: '7.3', generatedItems: [generated], generatedChampions: [], overrideItems: overrides, overrideChampions: [],
    reviewed: [], changedIds: NO_CHANGES, exclusiveGroups: {}, targets: [],
  })

  it('takes name, tier, cost, recipe and shared stats from the generated entry and keeps the rest', () => {
    const synced = buildPatchDataset(layer([handItem]), null).items.find((entry) => entry.id === 'hand')
    expect(synced).toEqual({
      ...handItem, name: 'New', cost: { total: 3300, combine: 500 }, recipe: ['a', 'b'], stats: { ad: 2, critDamage: 0.3, armor: 5 },
    })
  })

  it('keeps pinned fields and stats as written', () => {
    const pinned = { ...handItem, sourcePins: ['cost', 'stats.ad'] }
    const synced = buildPatchDataset(layer([pinned]), null).items.find((entry) => entry.id === 'hand')
    expect(synced?.cost).toEqual({ total: 3200, combine: 400 })
    expect(synced?.stats).toEqual({ ad: 1, critDamage: 0.3, armor: 5 })
    expect(synced?.recipe).toEqual(['a', 'b'])
  })

  it('leaves a hand-modelled item with no generated entry unchanged and keeps the inherited copy unsynced', () => {
    const dataset = buildPatchDataset({ ...layer([handItem]), generatedItems: [] }, null)
    expect(dataset.items).toEqual([handItem])
    expect(buildPatchDataset(layer([handItem]), null).handModelled.items).toEqual([handItem])
  })

  it('keeps a stale item at its last values until the change is covered, then syncs', () => {
    const rootDataset = buildPatchDataset(layer([handItem]), null)
    const moved: Item = { ...generated, cost: { total: 3400, combine: 600 }, stats: { ad: 3, armor: 5 } }
    const pending: PatchLayer = { ...layer([]), id: '7.3a', generatedItems: [moved], changedIds: { items: ['hand'], champions: [] }, exclusiveGroups: undefined, targets: undefined }
    const stale = buildPatchDataset(pending, rootDataset).items.find((entry) => entry.id === 'hand')
    expect(stale?.cost).toEqual({ total: 3300, combine: 500 })
    expect(stale?.stats).toEqual({ ad: 2, critDamage: 0.3, armor: 5 })
    expect(stale?.provenance.staleSince).toBe('7.3a')
    const reviewed = buildPatchDataset({ ...pending, reviewed: [{ kind: 'item', id: 'hand', note: 'checked' }] }, rootDataset)
    expect(reviewed.items.find((entry) => entry.id === 'hand')?.cost).toEqual({ total: 3400, combine: 600 })
  })
})

