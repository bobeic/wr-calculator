import { z } from 'zod'
import { StatEffectSchema } from './kinds/stat'
import { StatMultiplierEffectSchema } from './kinds/stat-multiplier'
import { StatConversionEffectSchema } from './kinds/stat-conversion'
import { StackingEffectSchema } from './kinds/stacking'

// Tasks 5, 6, and 7 append their kinds' schemas to this array.
export const EffectSchema = z.discriminatedUnion('kind', [
  StatEffectSchema,
  StatMultiplierEffectSchema,
  StatConversionEffectSchema,
  StackingEffectSchema,
])
export type Effect = z.infer<typeof EffectSchema>
export type EffectKind = Effect['kind']
