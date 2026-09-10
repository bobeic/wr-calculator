import { z } from 'zod'

/**
 * The closed set of conditions an Effect may gate on. No string expressions, no eval.
 */
export const ConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('targetHpBelow'), threshold: z.number() }).strict(),
  z.object({ type: z.literal('targetHpAbove'), threshold: z.number() }).strict(),
  z.object({ type: z.literal('stacksAtMax') }).strict(),
  z.object({ type: z.literal('toggle'), inputId: z.string() }).strict(),
  z.object({
    type: z.literal('damageType'), value: z.enum(['physical', 'magic', 'true']),
  }).strict(),
  z.object({
    type: z.literal('sourceKind'),
    value: z.enum(['basicAttack', 'ability', 'item', 'other']),
  }).strict(),
  z.object({ type: z.literal('targetIsChampion') }).strict(),
  z.object({ type: z.literal('targetIsMonster') }).strict(),
])
export type Condition = z.infer<typeof ConditionSchema>
