import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const ProcEveryNEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('procEveryN'),
  n: z.number().int().positive(),
  damageType: z.enum(['physical', 'magic', 'true']).optional(),
  damage: NullableScalarSchema.optional(),
  debuffId: z.string().optional(),
  resetsOnMiss: z.boolean().default(false),
})
export type ProcEveryNEffect = z.infer<typeof ProcEveryNEffectSchema>
