import { describe, it, expect } from 'vitest'
import type { CnChampionStat, CnStatsSnapshot } from '@wr-calc/data'
import { CN_STATS } from '@wr-calc/data'
import { assignTiers } from '../src/lib/site/tiers'
import { championLanes } from '../src/lib/site/champion-lanes'
import { changeLabel, pct } from '../src/lib/site/format'

const row = (championId: string, strengthRank: number): CnChampionStat => ({
  championId, heroId: '1', winRate: 0.5, pickRate: 0.1, banRate: 0, strengthRank,
})

describe('assignTiers', () => {
  it('cuts a lane into tiers by strength order', () => {
    const tiers = assignTiers(Array.from({ length: 40 }, (_, index) => row(`c${index}`, index + 1))).map((entry) => entry.tier)
    expect(tiers.filter((tier) => tier === 'S+')).toHaveLength(3)
    expect(tiers.filter((tier) => tier === 'S')).toHaveLength(7)
    expect(tiers.filter((tier) => tier === 'C')).toHaveLength(10)
    expect(tiers[0]).toBe('S+')
    expect(tiers[39]).toBe('C')
  })
})

describe('championLanes', () => {
  it('lists a champion\'s lanes, most picked first', () => {
    const stats = structuredClone(CN_STATS) as CnStatsSnapshot
    stats.ranks.all.top = [{ ...row('garen', 1), pickRate: 0.02 }]
    stats.ranks.all.mid = [{ ...row('garen', 3), pickRate: 0.05 }, row('ahri', 1)]
    stats.ranks.all.jungle = []
    stats.ranks.all.adc = []
    stats.ranks.all.support = []
    expect(championLanes(stats, 'garen').map((lane) => [lane.lane, lane.laneSize])).toEqual([['mid', 2], ['top', 1]])
  })
})

describe('pct', () => {
  it('formats a fraction', () => {
    expect(pct(0.538765)).toBe('53.9%')
  })
})

describe('changeLabel', () => {
  it('takes the words before the old value', () => {
    expect(changeLabel('Health per level : 128 → 136', '128')).toBe('Health per level:')
    expect(changeLabel('Damage: 33 - 333 → 40-285', '33 - 333')).toBe('Damage:')
  })
})
