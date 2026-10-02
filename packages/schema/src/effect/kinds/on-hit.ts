import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatRatioSchema } from './stat-ratio'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const OnHitEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('onHit'),
  /** 'adaptive': physical or magic by the owner's stats (rules.ts adaptiveDamageType). */
  damageType: z.enum(['physical', 'magic', 'true', 'adaptive']),
  flat: NullableScalarSchema.optional(),
  pctTargetCurrentHp: NullableScalarSchema.optional(),
  pctTargetMaxHp: NullableScalarSchema.optional(),
  pctTargetMissingHp: NullableScalarSchema.optional(),
  pctOwnStat: z.object({
    stat: StatKeySchema, layer: z.enum(['base', 'bonus', 'total']).optional(), ratio: NullableScalarSchema,
  }).strict().optional(),
  /** Added to the damage from the owner's stats (e.g. Brutal: 6% bonus AD + 3% AP). */
  ratios: z.array(StatRatioSchema).optional(),
  minDamage: NullableScalarSchema.optional(),
  maxDamage: NullableScalarSchema.optional(),
  monsterCap: NullableScalarSchema.optional(),
})
export type OnHitEffect = z.infer<typeof OnHitEffectSchema>
