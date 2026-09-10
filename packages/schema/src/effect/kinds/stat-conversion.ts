import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const StatConversionEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('statConversion'),
  fromStat: StatKeySchema,
  toStat: StatKeySchema,
  ratio: NullableScalarSchema,
})
export type StatConversionEffect = z.infer<typeof StatConversionEffectSchema>
