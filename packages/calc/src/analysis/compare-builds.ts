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

function breakpointsForSide(
  side: CompareBuildsSide, target: Combatant, scenario: CompareBuildsScenario, envelope: Envelope
): BuildBreakpoint[] {
  const breakpoints: BuildBreakpoint[] = []
  let gold = 0

  for (let itemCount = 1; itemCount <= side.build.items.length; itemCount++) {
    const itemIds = side.build.items.slice(0, itemCount)
    const build: Build = { ...side.build, items: itemIds }
    const combatant = combatantFromChampion(side.champion, side.level, build, side.catalog)
    mergeEnvelope(envelope, combatant.sheet)

    // combatantFromChampion above already validated every id in build.items/boots/enchant via
    // resolveStats, so the catalog lookups below are safe — same trust boundary combatant.ts uses.
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
  const aBreakpoints = breakpointsForSide(a, target, scenario, envelope)
  const bBreakpoints = breakpointsForSide(b, target, scenario, envelope)

  return {
    a: aBreakpoints, b: bBreakpoints,
    unsupportedEffects: [...envelope.unsupportedByEffectId.values()],
    dataWarnings: [...new Set(envelope.dataWarnings)],
    unverifiedRules: [...envelope.unverifiedRuleIds],
  }
}
