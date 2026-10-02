import { z } from 'zod'
import { NullableScalarSchema } from './scalar'

export const DamageTypeSchema = z.enum(['physical', 'magic', 'true'])
export type DamageType = z.infer<typeof DamageTypeSchema>

export const DamageRatioStatSchema = z.enum([
  'totalAd', 'bonusAd', 'ap', 'maxHp', 'bonusHp',
  'targetMaxHp', 'targetCurrentHp', 'targetMissingHp',
  // The target's missing Health as a fraction of its max, 0..1: "up to X based on missing Health" is X × this.
  'targetMissingHpFraction',
])
export type DamageRatioStat = z.infer<typeof DamageRatioStatSchema>

/**
 * One ratio term. With `perStat`, the coefficient is `value + perStat.value × perStat.stat`,
 * e.g. "7% (+0.04% per bonus AD) of max HP".
 */
export const DamageRatioSchema = z.object({
  stat: DamageRatioStatSchema,
  value: NullableScalarSchema,
  perStat: z.object({ stat: DamageRatioStatSchema, value: NullableScalarSchema }).strict().optional(),
}).strict()
export type DamageRatio = z.infer<typeof DamageRatioSchema>

export const DamageComponentSchema = z.object({
  type: DamageTypeSchema,
  base: NullableScalarSchema,
  ratios: z.array(DamageRatioSchema),
  hits: z.number().optional(),
  tags: z.array(z.string()),
}).strict()
export type DamageComponent = z.infer<typeof DamageComponentSchema>
