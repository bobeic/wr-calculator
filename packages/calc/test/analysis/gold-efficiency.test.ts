import { describe, it, expect } from 'vitest'
import type { Item } from '@wr-calc/schema'
import { goldEfficiency, statGoldValues } from '../../src/analysis/gold-efficiency'

const item = (id: string, tier: Item['tier'], total: number, stats: Item['stats'], effects: Item['effects'] = []): Item => ({
  id, name: id, tier, cost: { total, combine: total }, recipe: [], stats, effects, tags: [],
  provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
})
const SHOP = [
  item('long-sword', 'basic', 500, { ad: 12 }),
  item('ruby-crystal', 'basic', 500, { hp: 150 }),
  item('vampiric-scepter', 'epic', 1200, { ad: 20, lifesteal: 0.08 }),
  item('pickaxe', 'epic', 800, { ad: 20 }),
  item('mystery', 'epic', 900, { ad: 10, mr: 10, armor: 10 }),
  item('legend', 'legendary', 3000, { ad: 40, hp: 300, lifesteal: 0.1, critDamage: 0.3 }),
]

describe('statGoldValues', () => {
  const values = statGoldValues(SHOP)

  it('prices single-stat basic items first, preferring them over epics', () => {
    expect(values.ad).toEqual({ gold: 500 / 12, from: 'long-sword' })
    expect(values.hp?.gold).toBeCloseTo(500 / 150, 9)
  })

  it('derives a stat from an epic once its other stats are priced', () => {
    expect(values.lifesteal?.from).toBe('vampiric-scepter')
    expect(values.lifesteal?.gold).toBeCloseTo((1200 - 20 * (500 / 12)) / 0.08, 6)
  })

  it('leaves a stat unpriced when no item isolates it', () => {
    expect(values.mr).toBeUndefined()
    expect(values.armor).toBeUndefined()
  })
})

describe('goldEfficiency', () => {
  it('sums priced stats over cost and lists the unpriced ones', () => {
    const values = statGoldValues(SHOP)
    const result = goldEfficiency(SHOP[5], values)
    const expected = 40 * (500 / 12) + 300 * (500 / 150) + 0.1 * values.lifesteal!.gold
    expect(result.value).toBeCloseTo(expected, 6)
    expect(result.efficiency).toBeCloseTo(expected / 3000, 9)
    expect(result.unpriced).toEqual(['critDamage'])
  })

  it('is exactly 100% for the item a stat was priced from', () => {
    expect(goldEfficiency(SHOP[0], statGoldValues(SHOP)).efficiency).toBeCloseTo(1, 12)
  })
})
