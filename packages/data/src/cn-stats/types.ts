/**
 * Champion win, pick and ban rates from the Chinese (Tencent) Wild Rift server, per rank bracket and lane.
 * Source: https://mlol.qt.qq.com/go/lgame_battle_info/hero_rank_list_v2 (see
 * docs/superpowers/specs/2026-10-01-cn-preview-brainstorm.md §9). The CN server runs its own patch schedule, so these
 * rates can describe a different patch than the global data.
 */
export const CN_RANKS = ['all', 'diamond', 'master', 'challenger', 'peak'] as const
export type CnRank = (typeof CN_RANKS)[number]

export const CN_RANK_LABELS: Record<CnRank, string> = {
  all: 'All ranks', diamond: 'Diamond+', master: 'Master+', challenger: 'Challenger+', peak: 'Peak server',
}

export const LANES = ['top', 'jungle', 'mid', 'adc', 'support'] as const
export type Lane = (typeof LANES)[number]

export const LANE_LABELS: Record<Lane, string> = {
  top: 'Baron', jungle: 'Jungle', mid: 'Mid', adc: 'Dragon', support: 'Support',
}

export interface CnChampionStat {
  championId: string
  /** Tencent's hero id, e.g. '10001' (Garen). */
  heroId: string
  /** Fractions: 0.5388 = 53.88%. */
  winRate: number
  pickRate: number
  banRate: number
  /** Tencent's strength order within the lane, 1 = strongest. */
  strengthRank: number
}

export interface CnStatsSnapshot {
  source: string
  /** The day the rates describe, from Tencent's `dtstatdate` (YYYY-MM-DD). */
  statDate: string
  /** When we fetched them (ISO). */
  fetchedAt: string
  /** Tencent's hero data version at fetch time, e.g. '7.3'. */
  cnVersion: string
  ranks: Record<CnRank, Record<Lane, CnChampionStat[]>>
  /** Tencent hero ids we couldn't map to a champion id; their rows are dropped. */
  unmapped: string[]
}
