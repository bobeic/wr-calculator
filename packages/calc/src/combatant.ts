import type { Champion, Build, Item, Effect, Target } from '@wr-calc/schema'
import { abilityRankFor, championKitEffects } from './kit-effects'
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
  /** Effects carried by the champion's own abilities, rank values already bound. */
  kitEffects?: Effect[]
  inputs: Record<string, number | boolean>
  /** Fraction of max HP this combatant starts a combo at. */
  startHpFraction: number
  abilities?: Champion['abilities']
  /** The rank each ability is used at (1..maxRank); set for champions, every slot filled in. */
  abilityRanks?: Record<'q' | 'w' | 'e' | 'r', number>
}

/** Builds a combat-ready Combatant from a champion, level, and build, resolving its stats via resolveStats. */
export function combatantFromChampion(
  champion: Champion, level: number, build: Build, catalog: StatCatalog
): Combatant {
  const sheet = resolveStats(champion, level, build, catalog)
  for (const [slot, rank] of Object.entries(build.abilityRanks ?? {}) as Array<['q' | 'w' | 'e' | 'r', number | undefined]>) {
    const maxRank = champion.abilities[slot].maxRank
    if (rank !== undefined && (rank < 1 || rank > maxRank || !Number.isInteger(rank))) {
      throw new Error(`combatantFromChampion: ${champion.id} ${slot.toUpperCase()} rank ${rank} is outside 1..${maxRank}`)
    }
  }
  const abilityRanks = {
    q: abilityRankFor(champion, 'q', build.abilityRanks), w: abilityRankFor(champion, 'w', build.abilityRanks),
    e: abilityRankFor(champion, 'e', build.abilityRanks), r: abilityRankFor(champion, 'r', build.abilityRanks),
  }
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
    kitEffects: championKitEffects(champion, build.abilityRanks), inputs: build.inputs, startHpFraction: 1,
    abilities: champion.abilities, abilityRanks,
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
