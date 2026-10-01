import { z } from 'zod'
import { EffectBaseSchema } from './common'

/**
 * The next basic attack while off cooldown crits at `critMultiplier` in place of the normal crit
 * result, then the cooldown starts (e.g. Sundered Sky's Lightshield Strike).
 */
export const GuaranteedCritEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('guaranteedCrit'),
  critMultiplier: z.number().positive(),
  cooldownSeconds: z.number().nonnegative(),
})
export type GuaranteedCritEffect = z.infer<typeof GuaranteedCritEffectSchema>
