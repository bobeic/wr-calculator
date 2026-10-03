import type { Lane } from '../cn-stats/types'

/**
 * Popular builds on the Chinese (Tencent) Wild Rift server, Diamond+ bracket, per champion and lane.
 * Source: https://wrchina.gg/api/build/<heroId>_1.json, a third-party mirror of Tencent's build stats (found via a HAR
 * of wrchina.gg's champion page, 2026-10-02). Like CN_STATS, it can describe a different patch than the global data.
 */
export interface CnRatedSet {
  /** Our item ids (core builds) or rune ids (rune pages), in the source's order. */
  ids: string[]
  /** Fractions: 0.559 = 55.9%. */
  winRate: number
  pickRate: number
}

/** One opponent in a lane matchup. */
export interface CnMatchup {
  championId: string
  /** The opponent's win rate against this champion, as a fraction. */
  winRate: number
  /** How often the matchup happens, as a fraction (low = few games, noisy rate). */
  pickRate: number
}

export interface CnLaneBuilds {
  lane: Lane
  /** Three-item cores, most picked first. */
  core: CnRatedSet[]
  /** Rune pages (keystone first), most picked first. */
  runes: CnRatedSet[]
  /**
   * The toughest opponents in this lane, Diamond+, from wrchina.gg/api/counter/<heroId>.json (block "1", wrchina's
   * default bracket; its other blocks are higher brackets with fewer games). Their order. Absent before 2026-10-03.
   */
  matchups?: CnMatchup[]
}

export interface CnBuildsSnapshot {
  source: string
  /** The day the rates describe (YYYY-MM-DD). */
  statDate: string
  fetchedAt: string
  /** Champion id -> lanes, most picked lane first (source order). */
  champions: Record<string, CnLaneBuilds[]>
  /** Tencent ids we couldn't map; sets containing one are dropped. */
  unmapped: { heroes: string[]; items: string[]; runes: string[] }
}
