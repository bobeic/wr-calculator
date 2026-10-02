import { z } from 'zod'
import { EffectBaseSchema } from './common'

/** Damage that leaves the target below `thresholdFraction` of its max Health kills it (e.g. The Collector, 5%). */
export const ExecuteEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('execute'),
  thresholdFraction: z.number().positive().max(1),
})
export type ExecuteEffect = z.infer<typeof ExecuteEffectSchema>
