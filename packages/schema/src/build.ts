import { z } from 'zod'

export const BuildSchema = z.object({
  items: z.array(z.string()),
  boots: z.string().optional(),
  enchant: z.string().optional(),
  runes: z.array(z.string()),
  inputs: z.record(z.string(), z.union([z.number(), z.boolean()])),
})
export type Build = z.infer<typeof BuildSchema>
