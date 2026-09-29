import { z } from 'zod'
import { NullableScalarSchema } from './scalar'
import { DamageComponentSchema } from './damage-component'
import { EffectSchema } from './effect/effect'

export * from './damage-component'

/** A follow-up cast of an ability (e.g. a recast), available while its window is open. */
export const AbilityStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: z.enum(['press', 'dash']),
  /** Measured from the end of the previous stage's cast. */
  windowSeconds: z.number().positive(),
  castTime: z.number().nonnegative().optional(),
  damage: z.array(DamageComponentSchema),
}).strict()
export type AbilityStage = z.infer<typeof AbilityStageSchema>

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
  }).strict(),
  /** Handler id for kits that don't fit the declarative damage model, e.g. Nunu's Q throw. */
  custom: z.string().optional(),
  /** Mechanics the ability carries, using the same effect kinds as items (e.g. a passive stat). */
  effects: z.array(EffectSchema).optional(),
  /** Stages 2..n; the ability's own damage and castTime are stage 1. */
  stages: z.array(AbilityStageSchema).optional(),
  cooldownStartsOn: z.enum(['firstCast', 'lastStage']).optional(),
}).strict()
export type Ability = z.infer<typeof AbilitySchema>
