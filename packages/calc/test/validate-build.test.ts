import { describe, it, expect } from 'vitest'
import type { Build, Item } from '@wr-calc/schema'
import { validateBuild } from '../src/validate-build'
import { ITEM_SLOTS } from '../src/rules'

const item = (id: string, tier: Item['tier'], exclusiveGroup?: string): Item => ({
  id, name: id, tier, cost: { total: 100, combine: 100 }, recipe: [], stats: {}, effects: [], tags: [],
  ...(exclusiveGroup === undefined ? {} : { exclusiveGroup }),
  provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
})
const catalog = new Map([
  item('long-sword', 'basic'), item('pickaxe', 'epic'), item('cleaver', 'legendary', 'armor-pen'),
  item('grudge', 'legendary', 'armor-pen'), item('dance', 'legendary'), item('angel', 'legendary'),
  item('maw', 'legendary'), item('sky', 'legendary'), item('edge', 'legendary'), item('greaves', 'boots'),
].map((entry) => [entry.id, entry]))
const build = (items: string[], extra: Partial<Build> = {}): Build => ({ items, runes: [], inputs: {}, ...extra })
const codes = (b: Build) => validateBuild(b, catalog).map((issue) => issue.code)

describe('validateBuild', () => {
  it('accepts a full legal build, including repeated components', () => {
    expect(codes(build(['cleaver', 'dance', 'angel', 'maw', 'sky', 'long-sword'].slice(0, ITEM_SLOTS), { boots: 'greaves' }))).toEqual([])
    expect(codes(build(['long-sword', 'long-sword', 'pickaxe', 'pickaxe']))).toEqual([])
  })

  it('flags more items than the inventory holds', () => {
    const items = ['cleaver', 'dance', 'angel', 'maw', 'sky', 'edge', 'long-sword', 'long-sword'].slice(0, ITEM_SLOTS + 1)
    expect(codes(build(items))).toEqual(['too-many-items'])
  })

  it('flags a finished item held twice, once', () => {
    expect(codes(build(['dance', 'dance', 'dance']))).toEqual(['duplicate-item'])
  })

  it('flags boots outside the boots slot and non-boots inside it', () => {
    expect(codes(build(['greaves']))).toEqual(['boots-in-items'])
    expect(codes(build([], { boots: 'dance' }))).toEqual(['not-boots'])
  })

  it('flags two items from one exclusive group', () => {
    expect(validateBuild(build(['cleaver', 'grudge']), catalog)).toEqual([{
      code: 'exclusive-group',
      message: "items 'cleaver' and 'grudge' can't be held together (both in exclusive group 'armor-pen')",
    }])
  })

  it('flags unknown ids', () => {
    expect(codes(build(['nope'], { boots: 'nada' }))).toEqual(['unknown-item', 'unknown-item'])
  })
})
