import { z } from 'zod'
import { EffectBaseSchema } from './common'

/**
 * One stack per hit (a basic attack or an ability stage cast), added after the hit lands; each
 * stack refreshes the duration. Amplifies damage from the listed source kinds by
 * `amountPerStack` per live stack (e.g. Spear of Shojin's Focused Will).
 */
export const HitStackAmpEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('hitStackAmp'),
  amountPerStack: z.number().positive(),
  maxStacks: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  appliesTo: z.array(z.enum(['basicAttack', 'ability', 'item', 'passive', 'other'])).min(1),
})
export type HitStackAmpEffect = z.infer<typeof HitStackAmpEffectSchema>
