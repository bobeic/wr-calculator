import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatRatioSchema } from './stat-ratio'
import { NullableScalarSchema } from '../../scalar'

/**
 * Delayed bonus damage once the damage dealt to the target within a time window reaches a
 * fraction of its max HP, then an item cooldown (e.g. Stormsurge's Squall).
 */
export const DamageWindowProcEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('damageWindowProc'),
  targetMaxHpFraction: z.number().positive(),
  windowSeconds: z.number().positive(),
  delaySeconds: z.number().nonnegative(),
  damageType: z.enum(['physical', 'magic', 'true']),
  damage: NullableScalarSchema,
  ratios: z.array(StatRatioSchema)
    .default([]),
  cooldownSeconds: NullableScalarSchema,
})
export type DamageWindowProcEffect = z.infer<typeof DamageWindowProcEffectSchema>
