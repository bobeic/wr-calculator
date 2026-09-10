import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const ShieldEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('shield'),
  amount: NullableScalarSchema,
  durationSeconds: NullableScalarSchema,
})
export type ShieldEffect = z.infer<typeof ShieldEffectSchema>
