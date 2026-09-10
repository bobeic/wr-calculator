import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const CooldownRefundEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('cooldownRefund'),
  mode: z.enum(['flat', 'percent']),
  amount: NullableScalarSchema,
  excludesUltimate: z.boolean().default(true),
})
export type CooldownRefundEffect = z.infer<typeof CooldownRefundEffectSchema>
