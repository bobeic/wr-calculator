import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const ActiveEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('active'),
  cooldownSeconds: NullableScalarSchema,
  damageType: z.enum(['physical', 'magic', 'true']).optional(),
  damage: NullableScalarSchema.optional(),
})
export type ActiveEffect = z.infer<typeof ActiveEffectSchema>
