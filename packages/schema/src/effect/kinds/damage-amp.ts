import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { ConditionSchema } from '../condition'
import { NullableScalarSchema } from '../../scalar'

export const DamageAmpEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('damageAmp'),
  condition: ConditionSchema,
  /** Fraction added to damage, e.g. 0.1 = +10%. */
  amount: NullableScalarSchema,
})
export type DamageAmpEffect = z.infer<typeof DamageAmpEffectSchema>
