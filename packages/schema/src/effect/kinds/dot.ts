import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const DotEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('dot'),
  damageType: z.enum(['physical', 'magic', 'true']),
  tickAmount: NullableScalarSchema,
  tickIntervalSeconds: z.number(),
  durationSeconds: NullableScalarSchema,
  refresh: z.enum(['refresh', 'stack', 'ignore']),
})
export type DotEffect = z.infer<typeof DotEffectSchema>
