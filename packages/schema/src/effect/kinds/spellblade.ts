import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const SpellbladeEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('spellblade'),
  damageType: z.enum(['physical', 'magic', 'true']),
  bonusDamage: NullableScalarSchema,
  ratios: z.array(z.object({ stat: StatKeySchema, value: NullableScalarSchema })).default([]),
  internalCooldownSeconds: NullableScalarSchema,
})
export type SpellbladeEffect = z.infer<typeof SpellbladeEffectSchema>
