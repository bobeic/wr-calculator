import { z } from 'zod'
import { statKeyRecord } from './stat-key'
import { AbilitySchema } from './ability'
import { ProvenanceSchema } from './provenance'

/**
 * 'attackSpeed' is excluded here: a champion's base AS lives only in the dedicated
 * `attackSpeed` field below (base + level-scaling ratio). Without this omit, STAT_KEYS
 * (shared with Item.stats, which does need 'attackSpeed' for gear bonuses) would let the
 * same value be entered twice, in two different shapes, with no indication which one wins.
 */
export const ChampionBaseStatsSchema = statKeyRecord(
  z.object({ base: z.number(), perLevel: z.number() })
).omit({ attackSpeed: true })

// Extract abilities object with explicit type annotation using named references to avoid TS7056 serialization overflow.
export const ChampionAbilitiesSchema: z.ZodObject<{
  passive: typeof AbilitySchema
  q: typeof AbilitySchema
  w: typeof AbilitySchema
  e: typeof AbilitySchema
  r: typeof AbilitySchema
}> = z.object({
  passive: AbilitySchema,
  q: AbilitySchema,
  w: AbilitySchema,
  e: AbilitySchema,
  r: AbilitySchema,
}).strict()

const ChampionResourceSchema = z.enum(['mana', 'energy', 'none', 'other'])
const ChampionAttackSpeedSchema = z.object({ base: z.number(), ratio: z.number().optional() }).strict()

// Annotated with named references for the same TS7056 reason as ChampionAbilitiesSchema.
export const ChampionSchema: z.ZodObject<{
  id: z.ZodString
  name: z.ZodString
  resource: typeof ChampionResourceSchema
  baseStats: typeof ChampionBaseStatsSchema
  attackSpeed: typeof ChampionAttackSpeedSchema
  abilities: typeof ChampionAbilitiesSchema
  sourcePins: z.ZodOptional<z.ZodArray<z.ZodString>>
  provenance: typeof ProvenanceSchema
}, 'strict'> = z.object({
  id: z.string(),
  name: z.string(),
  resource: ChampionResourceSchema,
  baseStats: ChampionBaseStatsSchema,
  attackSpeed: ChampionAttackSpeedSchema,
  abilities: ChampionAbilitiesSchema,
  /** Hand-modelled champions only: fields kept as written instead of synced from the patch data, e.g. 'baseStats.ad'. */
  sourcePins: z.array(z.string()).optional(),
  provenance: ProvenanceSchema,
}).strict()
export type Champion = z.infer<typeof ChampionSchema>
