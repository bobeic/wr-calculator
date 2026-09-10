import { z } from 'zod'
import { EffectSchema } from './effect/effect'

// Rune paths and slots are data-driven (validated against runePaths.json at the data layer in
// a later step), so they're plain strings here rather than a hardcoded enum.
export const RuneSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  slot: z.string(),
  effects: z.array(EffectSchema),
}).strict()
export type Rune = z.infer<typeof RuneSchema>
