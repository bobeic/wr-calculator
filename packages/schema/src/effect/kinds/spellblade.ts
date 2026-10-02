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
  /** Added to the damage: the target's max HP times this (e.g. Divine Sunderer's 10%). */
  pctTargetMaxHp: NullableScalarSchema.optional(),
  /** Times the empowered attack applies on-hit effects again (e.g. Dusk and Dawn: 1). */
  extraOnHitApplications: z.number().int().nonnegative().optional(),
})
export type SpellbladeEffect = z.infer<typeof SpellbladeEffectSchema>
