import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

/** Bonus damage on the next damaging ability hit, then an item cooldown (e.g. Luden's Echo). */
export const AbilityHitProcEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('abilityHitProc'),
  damageType: z.enum(['physical', 'magic', 'true']),
  damage: NullableScalarSchema,
  ratios: z.array(z.object({ stat: StatKeySchema, value: NullableScalarSchema }).strict())
    .default([]),
  cooldownSeconds: NullableScalarSchema,
  // A boolean input that, when on, starts the proc on a full cooldown at time 0.
  startOnCooldownInputId: z.string().optional(),
})
export type AbilityHitProcEffect = z.infer<typeof AbilityHitProcEffectSchema>
