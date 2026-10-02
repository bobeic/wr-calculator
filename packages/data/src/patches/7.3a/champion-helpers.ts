import type { Ability, Champion, DamageComponent } from '@wr-calc/schema'
import { GENERATED_CHAMPIONS } from './generated/champions'
import { WRPOCKET_7_3A_PROVENANCE } from './provenance'

// Shared by the 7.3a hand-modelled kits (champions.ts, champions-batch2.ts).

/** The generated champion with hand-written abilities. */
export function modelled(id: string, abilities: Champion['abilities']): Champion {
  const generated = GENERATED_CHAMPIONS.find((champion) => champion.id === id)
  if (generated === undefined) throw new Error(`hand-modelled champion ${id} has no generated 7.3a entry`)
  return { ...generated, abilities, provenance: WRPOCKET_7_3A_PROVENANCE }
}

export function physical(base: DamageComponent['base'], ratios: DamageComponent['ratios']): DamageComponent {
  return { type: 'physical', base, ratios, tags: [] }
}

export function magic(base: DamageComponent['base'], ratios: DamageComponent['ratios']): DamageComponent {
  return { type: 'magic', base, ratios, tags: [] }
}

/** An ability with no damage of its own and no effects. */
export function utility(id: string, name: string, maxRank: number, cooldown: Ability['cooldown'], cost?: Ability['cost']): Ability {
  return { id, name, maxRank, cooldown, ...(cost !== undefined && { cost }), castTime: 0, damage: [], flags: {} }
}

/** A value that grows in a straight line from `first` at level 1 to `last` at level 15. */
export function byLevelLine(first: number, last: number): { byLevel: number[] } {
  return { byLevel: Array.from({ length: 15 }, (_, index) => first + ((last - first) * index) / 14) }
}
