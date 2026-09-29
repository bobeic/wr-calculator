import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'
import { StatKeySchema } from '../../stat-key'

export const ActiveEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('active'),
  cooldownSeconds: NullableScalarSchema,
  damageType: z.enum(['physical', 'magic', 'true']).optional(),
  damage: NullableScalarSchema.optional(),
  ratios: z.array(z.object({ stat: StatKeySchema, value: NullableScalarSchema }).strict()).optional(),
  /** Further hits on the same target, each dealing `fraction` of the first (e.g. Rocketbelt's bolts). */
  extraHits: z.object({
    count: z.number().int().nonnegative(), fraction: z.number().nonnegative(),
  }).strict().optional(),
})
export type ActiveEffect = z.infer<typeof ActiveEffectSchema>
