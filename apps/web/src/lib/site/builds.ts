import type { CnBuildsSnapshot, CnChampionStat, CnRatedSet, Lane } from '@wr-calc/data'

// A core counts as an off-meta winner when it beats the lane's most-picked core by at least this many win-rate points,
// in at least this share of the champion's games (below it the rate is mostly noise). ~30 builds pass on 2026-10-01 data.
export const GEM_MIN_LEAD = 0.03
export const GEM_MIN_PICK = 0.05

/** How far `row` out-wins the most-picked core, when it's an off-meta winner; null otherwise. */
export function gemLead(row: CnRatedSet, mostPicked: CnRatedSet | undefined): number | null {
  if (mostPicked === undefined || row === mostPicked || row.pickRate < GEM_MIN_PICK) return null
  const lead = row.winRate - mostPicked.winRate
  return lead >= GEM_MIN_LEAD ? lead : null
}

export interface HiddenGem {
  championId: string
  lane: Lane
  build: CnRatedSet
  mostPicked: CnRatedSet
  /** The lane's most-picked rune page, so a calculator link has runes. */
  runes: string[]
  lead: number
}

/** Every off-meta winning core, biggest lead first. */
export function hiddenGems(builds: CnBuildsSnapshot): HiddenGem[] {
  return Object.entries(builds.champions).flatMap(([championId, lanes]) => lanes.flatMap(({ lane, core, runes }) =>
    core.flatMap((build): HiddenGem[] => {
      const lead = gemLead(build, core[0])
      return lead === null ? [] : [{ championId, lane, build, mostPicked: core[0], runes: runes[0]?.ids ?? [], lead }]
    })))
    .sort((a, b) => b.lead - a.lead)
}

// Champions under this pick rate are left off "highest win rate" lists: too few games for the rate to mean much.
export const MIN_PICK_FOR_WIN_RATE = 0.01

/** A lane's champions by win rate, highest first, skipping rarely picked ones. */
export function byWinRate(rows: readonly CnChampionStat[], limit: number): CnChampionStat[] {
  return rows.filter((row) => row.pickRate >= MIN_PICK_FOR_WIN_RATE).sort((a, b) => b.winRate - a.winRate).slice(0, limit)
}
