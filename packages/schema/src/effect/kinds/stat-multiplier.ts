import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const StatMultiplierEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('statMultiplier'),
  stat: StatKeySchema,
  layer: z.enum(['base', 'bonus', 'total']),
  amount: NullableScalarSchema,
})
export type StatMultiplierEffect = z.infer<typeof StatMultiplierEffectSchema>
