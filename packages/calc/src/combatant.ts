import type { Champion, Build, Item, Effect, Target } from '@wr-calc/schema'
import { resolveStats } from './resolve-stats'
import type { StatCatalog, StatSheet } from './resolve-stats'
import { MAX_CHAMPION_LEVEL } from './rules'

export interface Combatant {
  id: string
  name: string
  kind: 'champion' | 'monster' | 'dummy'
  level: number
  sheet: StatSheet
  items: Item[]
  runeEffects: Effect[]
  inputs: Record<string, number | boolean>
  /** Fraction of max HP this combatant starts a combo at. */
  startHpFraction: number
  abilities?: Champion['abilities']
}

/** Builds a combat-ready Combatant from a champion, level, and build, resolving its stats via resolveStats. */
export function combatantFromChampion(
  champion: Champion, level: number, build: Build, catalog: StatCatalog
): Combatant {
  const sheet = resolveStats(champion, level, build, catalog)
  const itemIds = [
    ...build.items,
    ...(build.boots ? [build.boots] : []),
    ...(build.enchant ? [build.enchant] : []),
  ]
  // resolveStats above already throws on any unknown item/rune id, so every lookup here is safe.
  const items = itemIds.map((id) => catalog.items.get(id)!)
  const runeEffects = build.runes.flatMap((id) => catalog.runes.get(id)!.effects)
  return {
    id: champion.id, name: champion.name, kind: 'champion', level, sheet, items, runeEffects,
    inputs: build.inputs, startHpFraction: 1, abilities: champion.abilities,
  }
}

type TargetDummy = Extract<Target, { kind: 'dummy' }>

/** Builds a bare-stats Combatant from a dummy target — no abilities, no items. */
export function combatantFromDummy(dummy: TargetDummy): Combatant {
  const sheet: StatSheet = {
    base: {}, bonus: {}, total: { hp: dummy.hp, armor: dummy.armor, mr: dummy.mr },
    breakdown: [], unsupportedEffects: [], dataWarnings: [], unverifiedRules: [],
  }
  return {
    // A dummy has no champion level of its own; MAX_CHAMPION_LEVEL is the least-surprising default
    // for any byLevel/levelRange scalar a synthetic test effect attached to it might use.
    id: 'dummy', name: 'Training Dummy', kind: 'dummy', level: MAX_CHAMPION_LEVEL, sheet,
    items: [], runeEffects: dummy.effects ?? [], inputs: {},
    startHpFraction: dummy.startHpFraction ?? 1,
  }
}
