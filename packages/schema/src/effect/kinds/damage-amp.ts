import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { ConditionSchema } from '../condition'
import { NullableScalarSchema } from '../../scalar'

export const DamageAmpEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('damageAmp'),
  condition: ConditionSchema,
  /** Fraction added to damage, e.g. 0.1 = +10%. */
  amount: NullableScalarSchema,
  /** Scales `amount` from 0 at no target bonus Health to all of it at `fullAt` (Dominik's Regards: 1200). */
  scaleWithTargetBonusHp: z.object({ fullAt: z.number().positive() }).strict().optional(),
  /** Multiplies `amount` by the stacks of the owner's dot `effectId` on the target (Darius's R: +20% per Hemorrhage stack). */
  perTargetDotStack: z.object({ effectId: z.string() }).strict().optional(),
})
export type DamageAmpEffect = z.infer<typeof DamageAmpEffectSchema>
