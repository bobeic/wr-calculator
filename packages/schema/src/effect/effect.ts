import { z } from 'zod'
import { StatEffectSchema } from './kinds/stat'
import { StatMultiplierEffectSchema } from './kinds/stat-multiplier'
import { StatConversionEffectSchema } from './kinds/stat-conversion'
import { StackingEffectSchema } from './kinds/stacking'
import { OnHitEffectSchema } from './kinds/on-hit'
import { SpellbladeEffectSchema } from './kinds/spellblade'
import { ProcEveryNEffectSchema } from './kinds/proc-every-n'
import { DotEffectSchema } from './kinds/dot'

// Tasks 6 and 7 append their kinds' schemas to this array.
export const EffectSchema = z.discriminatedUnion('kind', [
  StatEffectSchema,
  StatMultiplierEffectSchema,
  StatConversionEffectSchema,
  StackingEffectSchema,
  OnHitEffectSchema,
  SpellbladeEffectSchema,
  ProcEveryNEffectSchema,
  DotEffectSchema,
])
export type Effect = z.infer<typeof EffectSchema>
export type EffectKind = Effect['kind']
