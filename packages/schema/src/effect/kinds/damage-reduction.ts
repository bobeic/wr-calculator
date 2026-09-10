import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const DamageReductionEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('damageReduction'),
  damageType: z.enum(['physical', 'magic', 'true', 'all']),
  /** Fraction of incoming damage removed. */
  amount: NullableScalarSchema,
})
export type DamageReductionEffect = z.infer<typeof DamageReductionEffectSchema>
