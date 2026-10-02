import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatRatioSchema } from './stat-ratio'
import { NullableScalarSchema } from '../../scalar'

export const ActiveEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('active'),
  cooldownSeconds: NullableScalarSchema,
  damageType: z.enum(['physical', 'magic', 'true']).optional(),
  damage: NullableScalarSchema.optional(),
  ratios: z.array(StatRatioSchema).optional(),
  /** Added to the damage: the target's max HP times this (e.g. Redemption's 10%). */
  targetMaxHpRatio: NullableScalarSchema.optional(),
  /** Further hits on the same target, each dealing `fraction` of the first (e.g. Rocketbelt's bolts). */
  extraHits: z.object({
    count: z.number().int().nonnegative(), fraction: z.number().nonnegative(),
  }).strict().optional(),
})
export type ActiveEffect = z.infer<typeof ActiveEffectSchema>
