import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatRatioSchema } from './stat-ratio'
import { NullableScalarSchema } from '../../scalar'

export const ShieldEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('shield'),
  amount: NullableScalarSchema,
  durationSeconds: NullableScalarSchema,
  /** Added to `amount` from the caster's stats (e.g. Seraph's Lifeline: 16% max mana). */
  ratios: z.array(StatRatioSchema).optional(),
})
export type ShieldEffect = z.infer<typeof ShieldEffectSchema>
