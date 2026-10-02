import { z } from 'zod'
import { CN_RANKS, LANES } from '../../src/cn-stats/types'
import type { CnChampionStat, CnRank, CnStatsSnapshot, Lane } from '../../src/cn-stats/types'

export const RANK_LIST_URL = 'https://mlol.qt.qq.com/go/lgame_battle_info/hero_rank_list_v2'
export const HERO_LIST_URL = 'https://game.gtimg.cn/images/lgamem/act/lrlib/js/heroList/hero_list.js'

const RawRowSchema = z.object({
  hero_id: z.string(), position: z.string(), strength: z.string(),
  appear_rate: z.string(), forbid_rate: z.string(), win_rate: z.string(), dtstatdate: z.string(),
}).passthrough()
export const RawRankListSchema = z.object({
  result: z.number(),
  data: z.record(z.string(), z.union([z.record(z.string(), z.array(RawRowSchema)), z.array(z.unknown())])),
}).passthrough()
export const RawHeroListSchema = z.object({
  heroList: z.record(z.string(), z.object({ heroId: z.string(), poster: z.string() }).passthrough()),
  version: z.string(),
}).passthrough()
export type RawRankList = z.infer<typeof RawRankListSchema>
export type RawHeroList = z.infer<typeof RawHeroListSchema>

// Tencent's bracket keys (per github.com/ry2x/WildRift-Merged-Stats-Data) and lane keys (checked 2026-10-02 against
// each lane's top pick: 1 Hwei, 2 Shen, 3 Senna, 4 Brand, 5 Rammus).
const RANK_KEYS: Record<string, CnRank> = { 0: 'all', 1: 'diamond', 2: 'master', 3: 'challenger', 4: 'peak' }
const LANE_KEYS: Record<string, Lane> = { 1: 'mid', 2: 'top', 3: 'adc', 4: 'support', 5: 'jungle' }

// Poster names that don't turn into our ids.
const POSTER_OVERRIDES: Record<string, string> = { Nunu: 'nunu-and-willump', MonkeyKing: 'wukong' }

/** Our champion id from a Tencent poster URL: '.../Posters/AurelionSol_0.jpg' -> 'aurelion-sol'. */
export function championIdFromPoster(poster: string): string {
  const name = (poster.split('/').pop() ?? '').replace(/_\d+\.\w+$/, '')
  return POSTER_OVERRIDES[name] ?? name.replace(/(?<=[a-z])(?=[A-Z])/g, '-').toLowerCase()
}

const isoDate = (yyyymmdd: string): string => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`

/** Maps Tencent's rank list and hero list onto our champion ids; `known` limits ids to champions we have. */
export function mapCnStats(
  rankList: RawRankList, heroList: RawHeroList, known: ReadonlySet<string>, fetchedAt: string,
): CnStatsSnapshot {
  const idByHero = new Map(Object.values(heroList.heroList).map((hero) => [hero.heroId, championIdFromPoster(hero.poster)]))
  const unmapped = new Set<string>()
  const ranks = Object.fromEntries(CN_RANKS.map((rank) => [rank, Object.fromEntries(LANES.map((lane) => [lane, [] as CnChampionStat[]]))])) as CnStatsSnapshot['ranks']
  let statDate = ''
  for (const [rankKey, lanes] of Object.entries(rankList.data)) {
    const rank = RANK_KEYS[rankKey]
    if (rank === undefined || Array.isArray(lanes)) continue
    for (const [laneKey, rows] of Object.entries(lanes)) {
      const lane = LANE_KEYS[laneKey]
      if (lane === undefined) continue
      for (const row of rows) {
        const championId = idByHero.get(row.hero_id)
        if (championId === undefined || !known.has(championId)) {
          unmapped.add(row.hero_id)
          continue
        }
        if (row.dtstatdate > statDate) statDate = row.dtstatdate
        ranks[rank][lane].push({
          championId, heroId: row.hero_id, winRate: Number(row.win_rate), pickRate: Number(row.appear_rate),
          banRate: Number(row.forbid_rate), strengthRank: Number(row.strength),
        })
      }
      ranks[rank][lane].sort((a, b) => a.strengthRank - b.strengthRank || a.championId.localeCompare(b.championId))
    }
  }
  return {
    source: RANK_LIST_URL, statDate: statDate === '' ? '' : isoDate(statDate), fetchedAt, cnVersion: heroList.version,
    ranks, unmapped: [...unmapped].sort(),
  }
}
