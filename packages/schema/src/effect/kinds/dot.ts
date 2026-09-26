import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'
import { StatKeySchema } from '../../stat-key'

export const DotEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('dot'),
  damageType: z.enum(['physical', 'magic', 'true']),
  tickAmount: NullableScalarSchema,
  tickIntervalSeconds: z.number().positive(),
  durationSeconds: NullableScalarSchema,
  refresh: z.enum(['refresh', 'stack', 'ignore']),
  /** Added to each tick: the attacker's stat times the ratio, read when the dot is applied. */
  ratios: z.array(z.object({ stat: StatKeySchema, value: NullableScalarSchema }).strict())
    .default([]),
  /** A flat resist reduction on the target for as long as the dot is active. */
  shredWhileActive: z.object({
    resist: z.enum(['armor', 'mr']), amount: NullableScalarSchema,
  }).strict().optional(),
})
export type DotEffect = z.infer<typeof DotEffectSchema>
