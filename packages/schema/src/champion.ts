import { z } from 'zod'
import { statKeyRecord } from './stat-key'
import { AbilitySchema } from './ability'

/**
 * 'attackSpeed' is excluded here: a champion's base AS lives only in the dedicated
 * `attackSpeed` field below (base + level-scaling ratio). Without this omit, STAT_KEYS
 * (shared with Item.stats, which does need 'attackSpeed' for gear bonuses) would let the
 * same value be entered twice, in two different shapes, with no indication which one wins.
 */
export const ChampionBaseStatsSchema = statKeyRecord(
  z.object({ base: z.number(), perLevel: z.number() })
).omit({ attackSpeed: true })

export const ChampionSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource: z.enum(['mana', 'energy', 'none', 'other']),
  baseStats: ChampionBaseStatsSchema,
  attackSpeed: z.object({ base: z.number(), ratio: z.number().optional() }).strict(),
  abilities: z.object({
    passive: AbilitySchema,
    q: AbilitySchema,
    w: AbilitySchema,
    e: AbilitySchema,
    r: AbilitySchema,
  }).strict(),
}).strict()
export type Champion = z.infer<typeof ChampionSchema>
