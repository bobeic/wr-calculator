import { z } from 'zod'

export const BuildSchema = z.object({
  items: z.array(z.string()),
  boots: z.string().optional(),
  enchant: z.string().optional(),
  runes: z.array(z.string()),
  /** Summoner spell ids (two per build in game). */
  spells: z.array(z.string()).optional(),
  /** Rank of each basic and ultimate ability, 1..maxRank; an ability left out is at its max rank. */
  abilityRanks: z.object({
    q: z.number().int().min(1).optional(),
    w: z.number().int().min(1).optional(),
    e: z.number().int().min(1).optional(),
    r: z.number().int().min(1).optional(),
  }).strict().optional(),
  // Keyed by arbitrary user-defined input ids (see EffectInputSchema) — a record, not a fixed
  // shape, so .strict() doesn't apply here.
  inputs: z.record(z.string(), z.union([z.number(), z.boolean()])),
}).strict()
export type Build = z.infer<typeof BuildSchema>
