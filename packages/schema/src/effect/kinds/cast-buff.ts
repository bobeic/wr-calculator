import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'

/**
 * Casting an ability in `slots` grants `amount` of `stat` (bonus layer) for `durationSeconds`, then a cooldown
 * (e.g. Experimental Hexplate's Overdrive after the ultimate). With `charges`, each basic attack spends one and
 * the buff ends when they run out.
 */
export const CastBuffEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('castBuff'),
  slots: z.array(z.enum(['q', 'w', 'e', 'r'])).min(1),
  stat: StatKeySchema,
  amount: z.number(),
  durationSeconds: z.number().positive(),
  cooldownSeconds: z.number().nonnegative(),
  charges: z.number().int().positive().optional(),
})
export type CastBuffEffect = z.infer<typeof CastBuffEffectSchema>
