import { z } from 'zod'
import { statKeyRecord } from './stat-key'
import { Ability, AbilitySchema } from './ability'
import { Provenance, ProvenanceSchema } from './provenance'

/**
 * 'attackSpeed' is excluded here: a champion's base AS lives only in the dedicated
 * `attackSpeed` field below (base + level-scaling ratio). Without this omit, STAT_KEYS
 * (shared with Item.stats, which does need 'attackSpeed' for gear bonuses) would let the
 * same value be entered twice, in two different shapes, with no indication which one wins.
 */
export const ChampionBaseStatsSchema = statKeyRecord(
  z.object({ base: z.number(), perLevel: z.number() })
).omit({ attackSpeed: true })

const abilitiesSchema = z.object({
  passive: AbilitySchema,
  q: AbilitySchema,
  w: AbilitySchema,
  e: AbilitySchema,
  r: AbilitySchema,
}).strict()

// Type annotation to avoid TypeScript serialization overflow
export type Champion = {
  id: string
  name: string
  resource: 'mana' | 'energy' | 'none' | 'other'
  baseStats: z.infer<typeof ChampionBaseStatsSchema>
  attackSpeed: { base: number; ratio?: number }
  abilities: { passive: Ability; q: Ability; w: Ability; e: Ability; r: Ability }
  provenance: Provenance
}

export const ChampionSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource: z.enum(['mana', 'energy', 'none', 'other']),
  baseStats: ChampionBaseStatsSchema,
  attackSpeed: z.object({ base: z.number(), ratio: z.number().optional() }).strict(),
  abilities: abilitiesSchema,
  provenance: ProvenanceSchema,
}).strict() as z.ZodType<Champion>
