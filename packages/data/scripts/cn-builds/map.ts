import { z } from 'zod'
import type { CnBuildsSnapshot, CnLaneBuilds, CnMatchup, CnRatedSet } from '../../src/cn-builds/types'
import type { Lane } from '../../src/cn-stats/types'

export const BUILD_URL = (heroId: string): string => `https://wrchina.gg/api/build/${heroId}_1.json`

const IdsSchema = z.array(z.object({ id: z.string() }).passthrough())
const RawCoreSchema = z.object({ items: IdsSchema, win: z.number(), pick: z.number() }).passthrough()
const RawRunesSchema = z.object({ runes: IdsSchema, win: z.number(), pick: z.number() }).passthrough()
export const RawBuildSchema = z.object({
  hero_id: z.string(),
  date: z.string(),
  positions: z.array(z.object({
    pos: z.string(), pos_label: z.string(), core: z.array(RawCoreSchema), runes: z.array(RawRunesSchema),
  }).passthrough()),
}).passthrough()
export type RawBuild = z.infer<typeof RawBuildSchema>

export const COUNTER_URL = (heroId: string): string => `https://wrchina.gg/api/counter/${heroId}.json`

// Block "1" is Diamond+ (wrchina's default; its app.js picks it first). `win` is the listed opponent's win rate.
export const RawCounterSchema = z.object({
  hero_id: z.string(),
  blocks: z.record(z.string(), z.array(z.object({
    pos: z.union([z.string(), z.number()]).transform(String), pos_label: z.string(),
    counters: z.array(z.object({ id: z.string(), win: z.number(), pick: z.number() }).passthrough()),
  }).passthrough())),
}).passthrough()
export type RawCounter = z.infer<typeof RawCounterSchema>

// wrchina's own lane keys, not Tencent's rank-list ones (checked 2026-10-02: Rengar 2 Top / 4 Giungla / 1 Mid,
// Senna 3 Bot).
const POS_KEYS: Record<string, Lane> = { 1: 'mid', 2: 'top', 3: 'adc', 4: 'jungle', 5: 'support' }

// Upgraded and transformed items wrpocket doesn't list, mapped to the item they grow from (Tencent ids, from
// wrchina's items.json `from`). ponytail: shown and simulated as the base item until we model the upgrades.
const UPGRADED_FROM: Record<string, string> = {
  2164: '2111', // Black Mist Scythe <- Spectral Sickle
  2165: '2107', // Bulwark of the Mountain <- Relic Shield
  2154: '2142', // Seraph's Embrace <- Archangel's Staff
  2263: '2262', // Muramana <- Manamune
  2356: '2355', // Fimbulwinter <- Winter's Approach
}

const fraction = (percent: number): number => Number((percent / 100).toFixed(6))

/** Maps wrchina build files onto our ids. `itemIds`/`runeIds` map Tencent ids to ours. */
export function mapCnBuilds(
  raws: readonly RawBuild[], championIdByHero: ReadonlyMap<string, string>,
  itemIds: ReadonlyMap<string, string>, runeIds: ReadonlyMap<string, string>, fetchedAt: string,
  counters: readonly RawCounter[] = [],
): CnBuildsSnapshot {
  const unmapped = { heroes: new Set<string>(), items: new Set<string>(), runes: new Set<string>() }
  const champions: CnBuildsSnapshot['champions'] = {}
  let statDate = ''
  const sets = (raw: Array<{ ids: Array<{ id: string }>; win: number; pick: number }>, key: 'items' | 'runes'): CnRatedSet[] => {
    const ids = key === 'items' ? itemIds : runeIds
    return raw.flatMap((set): CnRatedSet[] => {
      const tencent = set.ids.map((entry) => UPGRADED_FROM[entry.id] ?? entry.id)
      const missing = tencent.filter((id) => !ids.has(id))
      missing.forEach((id) => unmapped[key].add(id))
      if (missing.length > 0) return []
      return [{ ids: tencent.map((id) => ids.get(id)!), winRate: fraction(set.win), pickRate: fraction(set.pick) }]
    })
  }
  for (const raw of raws) {
    const championId = championIdByHero.get(raw.hero_id)
    if (championId === undefined) {
      unmapped.heroes.add(raw.hero_id)
      continue
    }
    if (raw.date > statDate) statDate = raw.date
    const lanes = raw.positions.flatMap((position): CnLaneBuilds[] => {
      const lane = POS_KEYS[position.pos]
      if (lane === undefined) throw new Error(`hero ${raw.hero_id}: unknown pos '${position.pos}' (${position.pos_label})`)
      return [{ lane, core: sets(position.core.map((set) => ({ ...set, ids: set.items })), 'items'),
        runes: sets(position.runes.map((set) => ({ ...set, ids: set.runes })), 'runes'), }]
    })
    if (lanes.length > 0) champions[championId] = lanes
  }
  for (const counter of counters) {
    const championId = championIdByHero.get(counter.hero_id)
    if (championId === undefined) continue
    for (const position of counter.blocks['1'] ?? []) {
      const lane = POS_KEYS[position.pos]
      if (lane === undefined) throw new Error(`hero ${counter.hero_id}: unknown counter pos '${position.pos}' (${position.pos_label})`)
      const matchups = position.counters.flatMap((opponent): CnMatchup[] => {
        const id = championIdByHero.get(opponent.id)
        if (id === undefined) {
          unmapped.heroes.add(opponent.id)
          return []
        }
        return [{ championId: id, winRate: fraction(opponent.win), pickRate: fraction(opponent.pick) }]
      })
      const lanes = champions[championId] ??= []
      const entry = lanes.find((existing) => existing.lane === lane)
      if (entry) entry.matchups = matchups
      else lanes.push({ lane, core: [], runes: [], matchups })
    }
  }
  const sorted = (set: Set<string>): string[] => [...set].sort()
  return {
    source: BUILD_URL('<heroId>'),
    statDate: statDate === '' ? '' : `${statDate.slice(0, 4)}-${statDate.slice(4, 6)}-${statDate.slice(6, 8)}`,
    fetchedAt,
    champions: Object.fromEntries(Object.entries(champions).sort(([a], [b]) => a.localeCompare(b))),
    unmapped: { heroes: sorted(unmapped.heroes), items: sorted(unmapped.items), runes: sorted(unmapped.runes) },
  }
}
