import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'
import { StatKeySchema } from '../../stat-key'

export const ShieldEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('shield'),
  amount: NullableScalarSchema,
  durationSeconds: NullableScalarSchema,
  /** Added to `amount` from the caster's stats (e.g. Seraph's Lifeline: 16% max mana). */
  ratios: z.array(z.object({ stat: StatKeySchema, value: NullableScalarSchema }).strict()).optional(),
})
export type ShieldEffect = z.infer<typeof ShieldEffectSchema>
