import { z } from 'zod'
import { EffectBaseSchema } from './common'

export const CustomEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('custom'),
  /** Handler id, implemented in packages/calc/src/custom/<handler>.ts and registered by id. */
  handler: z.string(),
})
export type CustomEffect = z.infer<typeof CustomEffectSchema>
