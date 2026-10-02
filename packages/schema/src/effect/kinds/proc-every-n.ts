import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatRatioSchema } from './stat-ratio'
import { NullableScalarSchema } from '../../scalar'

export const ProcEveryNEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('procEveryN'),
  n: z.number().int().positive(),
  damageType: z.enum(['physical', 'magic', 'true', 'adaptive']).optional(),
  damage: NullableScalarSchema.optional(),
  debuffId: z.string().optional(),
  resetsOnMiss: z.boolean().default(false),
  /**
   * What counts toward `n`: every damage instance (the default), or each basic attack, in which case the proc
   * merges into that attack (e.g. Kraken Slayer's every third attack).
   */
  countsFrom: z.enum(['damageInstance', 'basicAttack']).optional(),
  /** Added to `damage` from the owner's stats. */
  ratios: z.array(StatRatioSchema).optional(),
  /** Damage rises by `perMissingPct` for each 1% of the target's missing Health, up to `max` (Kraken: 0.0075, 0.75). */
  targetMissingHpAmp: z.object({ perMissingPct: z.number().nonnegative(), max: z.number().nonnegative() }).strict().optional(),
  /** A boolean input that, when on, makes the first counted attack proc (e.g. an Energized attack already charged). */
  startReadyInputId: z.string().optional(),
})
export type ProcEveryNEffect = z.infer<typeof ProcEveryNEffectSchema>
