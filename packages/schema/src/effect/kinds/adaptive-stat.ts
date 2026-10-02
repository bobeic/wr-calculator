import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { ScalarSchema } from '../../scalar'

/**
 * Adaptive bonus: `ad` Attack Damage when bonus AD is at least AP (read before this effect), otherwise `ap`
 * Ability Power (e.g. Gluttonous Greaves' Balance of Power: 12 AD or 20 AP). See rules.ts adaptiveDamageType.
 * With `stackInputId`, the amounts are per stack of that stackCount input (e.g. Eyeball Collection: 1.5 AD or 3 AP
 * per eyeball), up to `maxStacks`.
 */
export const AdaptiveStatEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('adaptiveStat'),
  ad: ScalarSchema,
  ap: ScalarSchema,
  stackInputId: z.string().optional(),
  maxStacks: z.number().int().positive().optional(),
})
export type AdaptiveStatEffect = z.infer<typeof AdaptiveStatEffectSchema>
