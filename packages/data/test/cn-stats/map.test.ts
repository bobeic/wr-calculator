import { describe, it, expect } from 'vitest'
import { championIdFromPoster, mapCnStats } from '../../scripts/cn-stats/map'
import type { RawHeroList, RawRankList } from '../../scripts/cn-stats/map'
import { CN_STATS } from '../../src/cn-stats'
import { CURRENT_PATCH, getPatchDataset } from '../../src/patches/registry'

const row = (heroId: string, position: string, strength: string, win = '0.5') => ({
  hero_id: heroId, position, strength, appear_rate: '0.1', forbid_rate: '0.2', win_rate: win, dtstatdate: '20260930',
})
const heroList: RawHeroList = {
  version: '7.3',
  heroList: {
    10001: { heroId: '10001', poster: 'https://x/Posters/Garen_0.jpg' },
    10009: { heroId: '10009', poster: 'https://x/Posters/MonkeyKing_0.jpg' },
    10099: { heroId: '10099', poster: 'https://x/Posters/Somebody_0.jpg' },
  },
}

describe('championIdFromPoster', () => {
  it('turns poster names into our ids, with overrides', () => {
    expect(championIdFromPoster('https://x/Posters/AurelionSol_0.jpg')).toBe('aurelion-sol')
    expect(championIdFromPoster('https://x/Posters/MonkeyKing_0.jpg')).toBe('wukong')
    expect(championIdFromPoster('https://x/Posters/Nunu_0.jpg')).toBe('nunu-willump')
  })
})

describe('mapCnStats', () => {
  const rankList: RawRankList = {
    result: 0,
    data: {
      0: { 2: [row('10009', '2', '2', '0.51'), row('10001', '2', '1', '0.53')], 5: [row('10099', '5', '1')] },
      4: [],
    },
  }
  const snapshot = mapCnStats(rankList, heroList, new Set(['garen', 'wukong']), '2026-10-02T00:00:00Z')

  it('maps brackets and lanes, sorted by strength', () => {
    expect(snapshot.ranks.all.top.map((entry) => [entry.championId, entry.winRate])).toEqual([['garen', 0.53], ['wukong', 0.51]])
    expect(snapshot.ranks.peak.top).toEqual([])
    expect(snapshot.statDate).toBe('2026-09-30')
    expect(snapshot.cnVersion).toBe('7.3')
  })

  it('drops rows for champions we don\'t have and lists their hero ids', () => {
    expect(snapshot.ranks.all.jungle).toEqual([])
    expect(snapshot.unmapped).toEqual(['10099'])
  })
})

describe('CN_STATS (committed snapshot)', () => {
  it('maps every hero and has rows in every lane of the all-ranks bracket', () => {
    expect(CN_STATS.unmapped).toEqual([])
    for (const rows of Object.values(CN_STATS.ranks.all)) expect(rows.length).toBeGreaterThan(10)
  })

  it('names only champions in the current dataset', () => {
    const ids = new Set(getPatchDataset(CURRENT_PATCH).champions.map((champion) => champion.id))
    const rows = Object.values(CN_STATS.ranks).flatMap((lanes) => Object.values(lanes).flat())
    expect(rows.filter((row) => !ids.has(row.championId)).map((row) => row.championId)).toEqual([])
  })
})
