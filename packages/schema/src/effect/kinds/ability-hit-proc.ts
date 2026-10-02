import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatRatioSchema } from './stat-ratio'
import { NullableScalarSchema } from '../../scalar'

/**
 * Bonus damage on the next hit of a kind in `triggeredBy` (default: a damaging ability), then an item cooldown
 * (e.g. Luden's Echo; Duskblade's Nightstalker on a basic attack).
 */
export const AbilityHitProcEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('abilityHitProc'),
  /** 'adaptive': physical or magic by the owner's stats (rules.ts adaptiveDamageType). */
  damageType: z.enum(['physical', 'magic', 'true', 'adaptive']),
  damage: NullableScalarSchema,
  ratios: z.array(StatRatioSchema)
    .default([]),
  cooldownSeconds: NullableScalarSchema,
  // A boolean input that, when on, starts the proc on a full cooldown at time 0.
  startOnCooldownInputId: z.string().optional(),
  /** `empoweredAttack` is a basic attack that spent an empowered-attack charge. Defaults to ['ability']. */
  triggeredBy: z.array(z.enum(['ability', 'basicAttack', 'empoweredAttack'])).min(1).optional(),
  /** Added to the damage: the target's max Health times this (Aatrox's Deathbringer Stance: 4%). */
  pctTargetMaxHp: NullableScalarSchema.optional(),
  /** Added to the damage: the target's current Health times this (Jarvan IV's Martial Cadence: 8%). */
  pctTargetCurrentHp: NullableScalarSchema.optional(),
  /** Adds `amount` per stack of a stackCount input (e.g. Dark Harvest: 11 per soul). */
  damagePerStack: z.object({ inputId: z.string(), amount: z.number() }).strict().optional(),
  /** Procs at most once per combo (e.g. Dead Man's Plate's Momentum is spent by the first attack). */
  oncePerCombo: z.boolean().optional(),
})
export type AbilityHitProcEffect = z.infer<typeof AbilityHitProcEffectSchema>
