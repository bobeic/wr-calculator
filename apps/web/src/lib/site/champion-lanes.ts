import { LANES } from '@wr-calc/data'
import type { CnStatsSnapshot, Lane, CnRank } from '@wr-calc/data'

export interface LaneStat {
  lane: Lane
  winRate: number
  pickRate: number
  banRate: number
  strengthRank: number
  laneSize: number
}

/** A champion's rates in every lane it's listed in for a bracket, most picked first. */
export function championLanes(stats: CnStatsSnapshot, championId: string, rank: CnRank = 'all'): LaneStat[] {
  return LANES.flatMap((lane): LaneStat[] => {
    const rows = stats.ranks[rank][lane]
    const row = rows.find((entry) => entry.championId === championId)
    return row === undefined ? [] : [{
      lane, winRate: row.winRate, pickRate: row.pickRate, banRate: row.banRate, strengthRank: row.strengthRank,
      laneSize: rows.length,
    }]
  }).sort((a, b) => b.pickRate - a.pickRate)
}
