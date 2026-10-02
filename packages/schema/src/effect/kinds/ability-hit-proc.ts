import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatRatioSchema } from './stat-ratio'
import { NullableScalarSchema } from '../../scalar'

/**
 * Bonus damage on the next hit of a kind in `triggeredBy` (default: a damaging ability), then an item cooldown
 * (e.g. Luden's Echo; Duskblade's Nightstalker on a basic attack).
 */
export const AbilityHitProcEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('abilityHitProc'),
  damageType: z.enum(['physical', 'magic', 'true']),
  damage: NullableScalarSchema,
  ratios: z.array(StatRatioSchema)
    .default([]),
  cooldownSeconds: NullableScalarSchema,
  // A boolean input that, when on, starts the proc on a full cooldown at time 0.
  startOnCooldownInputId: z.string().optional(),
  /** `empoweredAttack` is a basic attack that spent an empowered-attack charge. Defaults to ['ability']. */
  triggeredBy: z.array(z.enum(['ability', 'basicAttack', 'empoweredAttack'])).min(1).optional(),
  /** Procs at most once per combo (e.g. Dead Man's Plate's Momentum is spent by the first attack). */
  oncePerCombo: z.boolean().optional(),
})
export type AbilityHitProcEffect = z.infer<typeof AbilityHitProcEffectSchema>
