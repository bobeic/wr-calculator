import { z } from 'zod'
import { statKeyRecord } from './stat-key'
import { AbilitySchema } from './ability'

export const ChampionBaseStatsSchema = statKeyRecord(
  z.object({ base: z.number(), perLevel: z.number() })
).strict()

export const ChampionSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource: z.enum(['mana', 'energy', 'none', 'other']),
  baseStats: ChampionBaseStatsSchema,
  attackSpeed: z.object({ base: z.number(), ratio: z.number().optional() }),
  abilities: z.object({
    passive: AbilitySchema,
    q: AbilitySchema,
    w: AbilitySchema,
    e: AbilitySchema,
    r: AbilitySchema,
  }),
})
export type Champion = z.infer<typeof ChampionSchema>
