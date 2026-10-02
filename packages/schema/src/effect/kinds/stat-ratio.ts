import { z } from 'zod'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

/** The owner's `stat` times `value`. `layer` picks base, bonus or total (omitted means total). */
export const StatRatioSchema = z.object({
  stat: StatKeySchema,
  layer: z.enum(['base', 'bonus', 'total']).optional(),
  value: NullableScalarSchema,
}).strict()
export type StatRatio = z.infer<typeof StatRatioSchema>
