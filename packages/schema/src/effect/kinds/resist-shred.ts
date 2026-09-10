import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const ResistShredEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('resistShred'),
  resist: z.enum(['armor', 'mr']),
  mode: z.enum(['flat', 'percent']),
  amount: NullableScalarSchema,
  stacking: z.boolean().default(false),
  maxStacks: z.number().optional(),
  durationSeconds: NullableScalarSchema.optional(),
})
export type ResistShredEffect = z.infer<typeof ResistShredEffectSchema>
