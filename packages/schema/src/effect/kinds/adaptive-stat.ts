import { z } from 'zod'
import { EffectBaseSchema } from './common'

/**
 * Adaptive bonus: `ad` Attack Damage when bonus AD is at least AP (read before this effect), otherwise `ap`
 * Ability Power (e.g. Gluttonous Greaves' Balance of Power: 12 AD or 20 AP). See rules.ts adaptiveDamageType.
 */
export const AdaptiveStatEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('adaptiveStat'),
  ad: z.number(),
  ap: z.number(),
})
export type AdaptiveStatEffect = z.infer<typeof AdaptiveStatEffectSchema>
