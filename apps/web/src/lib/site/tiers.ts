import type { CnChampionStat } from '@wr-calc/data'

export const TIERS = ['S+', 'S', 'A', 'B', 'C'] as const
export type Tier = (typeof TIERS)[number]

// Our own cut-offs over Tencent's strength order (1 = strongest): the share of a lane's champions in each tier,
// best first. Not Tencent's tiers; Tencent's `strength_level` is always 0 in the feed.
const TIER_SHARES: Record<Tier, number> = { 'S+': 0.08, S: 0.17, A: 0.25, B: 0.25, C: 0.25 }

export interface TieredStat extends CnChampionStat {
  tier: Tier
}

/** Assigns tiers by position in the lane's strength order. Rows must come sorted by strengthRank. */
export function assignTiers(rows: readonly CnChampionStat[]): TieredStat[] {
  const bounds: Array<[Tier, number]> = []
  let cumulative = 0
  for (const tier of TIERS) {
    cumulative += TIER_SHARES[tier]
    bounds.push([tier, cumulative])
  }
  return rows.map((row, index) => {
    const position = (index + 1) / rows.length
    const tier = bounds.find(([, upTo]) => position <= upTo + 1e-9)?.[0] ?? 'C'
    return { ...row, tier }
  })
}
