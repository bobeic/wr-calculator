import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const OnHitEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('onHit'),
  damageType: z.enum(['physical', 'magic', 'true']),
  flat: NullableScalarSchema.optional(),
  pctTargetCurrentHp: NullableScalarSchema.optional(),
  pctTargetMaxHp: NullableScalarSchema.optional(),
  pctTargetMissingHp: NullableScalarSchema.optional(),
  pctOwnStat: z.object({ stat: StatKeySchema, ratio: NullableScalarSchema }).optional(),
  minDamage: NullableScalarSchema.optional(),
  maxDamage: NullableScalarSchema.optional(),
  monsterCap: NullableScalarSchema.optional(),
})
export type OnHitEffect = z.infer<typeof OnHitEffectSchema>
