import { z } from 'zod'
import { StatEffectSchema } from './kinds/stat'
import { StatMultiplierEffectSchema } from './kinds/stat-multiplier'
import { StatConversionEffectSchema } from './kinds/stat-conversion'
import { StackingEffectSchema } from './kinds/stacking'
import { OnHitEffectSchema } from './kinds/on-hit'
import { SpellbladeEffectSchema } from './kinds/spellblade'
import { ProcEveryNEffectSchema } from './kinds/proc-every-n'
import { DotEffectSchema } from './kinds/dot'
import { ResistShredEffectSchema } from './kinds/resist-shred'
import { PenetrationEffectSchema } from './kinds/penetration'
import { DamageAmpEffectSchema } from './kinds/damage-amp'
import { CooldownRefundEffectSchema } from './kinds/cooldown-refund'
import { DamageReductionEffectSchema } from './kinds/damage-reduction'

// Task 7 appends its kinds' schemas to this array.
export const EffectSchema = z.discriminatedUnion('kind', [
  StatEffectSchema,
  StatMultiplierEffectSchema,
  StatConversionEffectSchema,
  StackingEffectSchema,
  OnHitEffectSchema,
  SpellbladeEffectSchema,
  ProcEveryNEffectSchema,
  DotEffectSchema,
  ResistShredEffectSchema,
  PenetrationEffectSchema,
  DamageAmpEffectSchema,
  CooldownRefundEffectSchema,
  DamageReductionEffectSchema,
])
export type Effect = z.infer<typeof EffectSchema>
export type EffectKind = Effect['kind']
