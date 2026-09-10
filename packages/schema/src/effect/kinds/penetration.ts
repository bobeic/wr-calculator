import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { ConditionSchema } from '../condition'
import { NullableScalarSchema } from '../../scalar'

export const PenetrationEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('penetration'),
  resist: z.enum(['armor', 'mr']),
  mode: z.enum(['flat', 'percent']),
  amount: NullableScalarSchema,
  // Unconditional pen is expressed as a plain stat effect; this kind is for conditional pen only.
  condition: ConditionSchema,
})
export type PenetrationEffect = z.infer<typeof PenetrationEffectSchema>
