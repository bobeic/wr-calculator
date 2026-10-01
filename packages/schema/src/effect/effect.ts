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
import { ShieldEffectSchema } from './kinds/shield'
import { HealEffectSchema } from './kinds/heal'
import { ActiveEffectSchema } from './kinds/active'
import { AbilityHitProcEffectSchema } from './kinds/ability-hit-proc'
import { DamageWindowProcEffectSchema } from './kinds/damage-window-proc'
import { CombatRampAmpEffectSchema } from './kinds/combat-ramp-amp'
import { EmpoweredAttackEffectSchema } from './kinds/empowered-attack'
import { GuaranteedCritEffectSchema } from './kinds/guaranteed-crit'
import { HitStackAmpEffectSchema } from './kinds/hit-stack-amp'
import { HitStackProcEffectSchema } from './kinds/hit-stack-proc'
import { CustomEffectSchema } from './kinds/custom'

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
  ShieldEffectSchema,
  HealEffectSchema,
  ActiveEffectSchema,
  AbilityHitProcEffectSchema,
  DamageWindowProcEffectSchema,
  CombatRampAmpEffectSchema,
  EmpoweredAttackEffectSchema,
  GuaranteedCritEffectSchema,
  HitStackAmpEffectSchema,
  HitStackProcEffectSchema,
  CustomEffectSchema,
])
export type Effect = z.infer<typeof EffectSchema>
export type EffectKind = Effect['kind']

export * from './kinds/stat'
export * from './kinds/stat-multiplier'
export * from './kinds/stat-conversion'
export * from './kinds/stacking'
export * from './kinds/on-hit'
export * from './kinds/spellblade'
export * from './kinds/proc-every-n'
export * from './kinds/dot'
export * from './kinds/resist-shred'
export * from './kinds/penetration'
export * from './kinds/damage-amp'
export * from './kinds/cooldown-refund'
export * from './kinds/damage-reduction'
export * from './kinds/shield'
export * from './kinds/heal'
export * from './kinds/active'
export * from './kinds/ability-hit-proc'
export * from './kinds/damage-window-proc'
export * from './kinds/combat-ramp-amp'
export * from './kinds/empowered-attack'
export * from './kinds/guaranteed-crit'
export * from './kinds/hit-stack-amp'
export * from './kinds/hit-stack-proc'
export * from './kinds/custom'
export * from './condition'
export * from './kinds/common'
