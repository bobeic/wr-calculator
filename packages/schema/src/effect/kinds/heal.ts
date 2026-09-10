import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const HealEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('heal'),
  amount: NullableScalarSchema,
})
export type HealEffect = z.infer<typeof HealEffectSchema>
