import type { Champion, Build } from '@wr-calc/schema'
import type { Combatant } from '../combatant'
import { combatantFromChampion } from '../combatant'
import type { StatCatalog } from '../resolve-stats'
import type { AbilityKey } from '../effects/types'
import type { ComboAction } from '../simulate-combo'
import { simulateCombo } from '../simulate-combo'
import type { UnsupportedEffectEntry } from '../result-envelope'
import type { UnverifiedRuleId } from '../rules'
import { sustainedDps } from './sustained-dps'
import { effectiveHp } from './effective-hp'
import type { EffectiveHp } from './effective-hp'

export interface CompareBuildsSide {
  champion: Champion
  level: number
  build: Build
  catalog: StatCatalog
}

export interface CompareBuildsScenario {
  durationSeconds: number
  priority: AbilityKey[]
  burstSequence: ComboAction[]
}

export interface BuildBreakpoint {
  gold: number
  burst: number
  dps: number
  ttk?: number
  ehp: EffectiveHp
}

export interface CompareBuildsResult {
  a: BuildBreakpoint[]
  b: BuildBreakpoint[]
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}

interface Envelope {
  unsupportedByEffectId: Map<string, UnsupportedEffectEntry>
  dataWarnings: string[]
  unverifiedRuleIds: Set<UnverifiedRuleId>
}

function mergeEnvelope(envelope: Envelope, source: {
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}): void {
  for (const entry of source.unsupportedEffects) envelope.unsupportedByEffectId.set(entry.id, entry)
  source.dataWarnings.forEach((warning) => envelope.dataWarnings.push(warning))
  source.unverifiedRules.forEach((id) => envelope.unverifiedRuleIds.add(id))
}

// Read-only identity bookkeeping, not shared combat state: it hands each distinct StatCatalog
// object a stable small integer purely so cache keys built from two different catalogs can never
// collide. The combatant cache itself is created fresh per compareBuilds call and keys are only
// ever compared within one call, so the absolute ids never reach a computed value and the engine
// stays deterministic.
const catalogIdentities = new WeakMap<StatCatalog, number>()
let nextCatalogIdentity = 0

function catalogIdentity(catalog: StatCatalog): number {
  const existing = catalogIdentities.get(catalog)
  if (existing !== undefined) return existing
  const assigned = nextCatalogIdentity++
  catalogIdentities.set(catalog, assigned)
  return assigned
}

/**
 * A collision-safe cache key for one resolved Combatant. Every segment goes through a single
 * JSON.stringify of a structured array rather than being concatenated with a delimiter, so no id
 * containing a separator character can make two structurally different builds share a key.
 */
function cacheKey(
  catalog: StatCatalog, championId: string, level: number, itemIds: string[], runeIds: string[],
  inputs: Record<string, number | boolean>
): string {
  return JSON.stringify([
    catalogIdentity(catalog), championId, level, itemIds, runeIds,
    Object.keys(inputs).sort().map((key) => [key, inputs[key]]),
  ])
}

function breakpointsForSide(
  side: CompareBuildsSide, target: Combatant, scenario: CompareBuildsScenario, envelope: Envelope,
  combatantCache: Map<string, Combatant>
): BuildBreakpoint[] {
  const breakpoints: BuildBreakpoint[] = []
  let gold = 0

  for (let itemCount = 1; itemCount <= side.build.items.length; itemCount++) {
    const itemIds = side.build.items.slice(0, itemCount)
    const build: Build = { ...side.build, items: itemIds }
    // The key must cover every id combatantFromChampion actually resolves against (build.items
    // plus boots/enchant), not just the staged generic items — otherwise two sides sharing the
    // same generic items but different boots/enchant would wrongly collide in the cache. It must
    // also cover the catalog the ids resolve *through*: the two sides carry independent catalogs,
    // so an id-only key would let side b reuse a Combatant resolved from side a's catalog.
    const fullItemIds = [
      ...itemIds, ...(build.boots ? [build.boots] : []), ...(build.enchant ? [build.enchant] : []),
    ]
    const key = cacheKey(
      side.catalog, side.champion.id, side.level, fullItemIds, build.runes, build.inputs
    )
    let combatant = combatantCache.get(key)
    if (!combatant) {
      combatant = combatantFromChampion(side.champion, side.level, build, side.catalog)
      combatantCache.set(key, combatant)
    }
    mergeEnvelope(envelope, combatant.sheet)

    // combatantFromChampion validated every id in build.items/boots/enchant against this exact
    // catalog via resolveStats when the cache entry was created, so the lookups below are safe —
    // same trust boundary combatant.ts uses. On a cache hit that validation happened on an earlier
    // breakpoint rather than on this call, which is equally sound because the key pins the catalog
    // identity: a hit can only come from an entry resolved against this same catalog object.
    if (itemCount === 1) {
      if (side.build.boots) gold += side.catalog.items.get(side.build.boots)!.cost.total
      if (side.build.enchant) gold += side.catalog.items.get(side.build.enchant)!.cost.total
    }
    gold += side.catalog.items.get(itemIds[itemIds.length - 1])!.cost.total

    const burstResult = simulateCombo(
      combatant, target, scenario.burstSequence, { critMode: 'expected', ignoreCooldowns: true }
    )
    mergeEnvelope(envelope, burstResult)
    const burst = Object.values(burstResult.totalsByType).reduce(
      (sum, value) => sum + (value ?? 0), 0
    )

    const dps = sustainedDps(combatant, target, scenario.durationSeconds, scenario.priority)

    breakpoints.push({ gold, burst, dps, ttk: burstResult.timeToKill, ehp: effectiveHp(combatant.sheet) })
  }
  return breakpoints
}

/** Computes a gold/burst/dps/ttk/ehp series at every item breakpoint for two builds, for crossover charts. */
export function compareBuilds(
  a: CompareBuildsSide, b: CompareBuildsSide, target: Combatant, scenario: CompareBuildsScenario
): CompareBuildsResult {
  const envelope: Envelope = {
    unsupportedByEffectId: new Map(), dataWarnings: [], unverifiedRuleIds: new Set(),
  }
  const combatantCache = new Map<string, Combatant>()
  const aBreakpoints = breakpointsForSide(a, target, scenario, envelope, combatantCache)
  const bBreakpoints = breakpointsForSide(b, target, scenario, envelope, combatantCache)

  return {
    a: aBreakpoints, b: bBreakpoints,
    unsupportedEffects: [...envelope.unsupportedByEffectId.values()],
    dataWarnings: [...new Set(envelope.dataWarnings)],
    unverifiedRules: [...envelope.unverifiedRuleIds],
  }
}
