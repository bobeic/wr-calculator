import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const StackingEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('stacking'),
  stat: StatKeySchema,
  perStack: NullableScalarSchema,
  maxStacks: z.number(),
  /** References the `id` of an `inputs[]` entry of type 'stackCount' that drives this effect. */
  stackInputId: z.string(),
})
export type StackingEffect = z.infer<typeof StackingEffectSchema>
