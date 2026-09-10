import { z } from 'zod'
import { NullableScalarSchema } from './scalar'

export const DamageTypeSchema = z.enum(['physical', 'magic', 'true'])

export const DamageRatioStatSchema = z.enum([
  'totalAd', 'bonusAd', 'ap', 'maxHp', 'bonusHp',
  'targetMaxHp', 'targetCurrentHp', 'targetMissingHp',
])

export const DamageComponentSchema = z.object({
  type: DamageTypeSchema,
  base: NullableScalarSchema,
  ratios: z.array(z.object({ stat: DamageRatioStatSchema, value: NullableScalarSchema })),
  hits: z.number().optional(),
  tags: z.array(z.string()),
})
export type DamageComponent = z.infer<typeof DamageComponentSchema>

export const AbilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  maxRank: z.number(),
  cooldown: NullableScalarSchema,
  cost: NullableScalarSchema.optional(),
  castTime: z.number(),
  damage: z.array(DamageComponentSchema),
  flags: z.object({
    appliesOnHit: z.boolean().optional(),
    triggersSpellblade: z.boolean().optional(),
    resetsBasicAttack: z.boolean().optional(),
  }),
  /** Handler id for kits that don't fit the declarative damage model, e.g. Nunu's Q throw. */
  custom: z.string().optional(),
})
export type Ability = z.infer<typeof AbilitySchema>
