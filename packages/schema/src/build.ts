import { z } from 'zod'

export const BuildSchema = z.object({
  items: z.array(z.string()),
  boots: z.string().optional(),
  enchant: z.string().optional(),
  runes: z.array(z.string()),
  // Keyed by arbitrary user-defined input ids (see EffectInputSchema) — a record, not a fixed
  // shape, so .strict() doesn't apply here.
  inputs: z.record(z.string(), z.union([z.number(), z.boolean()])),
}).strict()
export type Build = z.infer<typeof BuildSchema>
