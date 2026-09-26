import { z } from 'zod'
import { EffectBaseSchema } from './common'

/**
 * Amplifies all damage by `amountPerStack` per stack. Dealing damage starts combat without
 * amplifying that first hit; combat grants one stack at once and one more every
 * `stackIntervalSeconds`, up to `maxStacks` (e.g. Liandry's Madness).
 */
export const CombatRampAmpEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('combatRampAmp'),
  amountPerStack: z.number(),
  stackIntervalSeconds: z.number().positive(),
  maxStacks: z.number().int().positive(),
})
export type CombatRampAmpEffect = z.infer<typeof CombatRampAmpEffectSchema>
