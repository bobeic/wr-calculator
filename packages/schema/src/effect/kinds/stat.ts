import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const StatEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('stat'),
  stat: StatKeySchema,
  amount: NullableScalarSchema,
})
export type StatEffect = z.infer<typeof StatEffectSchema>
