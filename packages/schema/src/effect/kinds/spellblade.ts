import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const SpellbladeEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('spellblade'),
  damageType: z.enum(['physical', 'magic', 'true']),
  bonusDamage: NullableScalarSchema,
  /** Each ratio reads `layer` of `stat`; omitted means total (e.g. Lich Bane reads base AD). */
  ratios: z.array(z.object({
    stat: StatKeySchema,
    layer: z.enum(['base', 'bonus', 'total']).optional(),
    value: NullableScalarSchema,
  }).strict())
    .default([]),
  internalCooldownSeconds: NullableScalarSchema,
})
export type SpellbladeEffect = z.infer<typeof SpellbladeEffectSchema>
