import { z } from 'zod'

/**
 * The closed set of conditions an Effect may gate on. No string expressions, no eval.
 */
export const ConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('targetHpBelow'), threshold: z.number() }),
  z.object({ type: z.literal('targetHpAbove'), threshold: z.number() }),
  z.object({ type: z.literal('stacksAtMax') }),
  z.object({ type: z.literal('toggle'), inputId: z.string() }),
  z.object({ type: z.literal('damageType'), value: z.enum(['physical', 'magic', 'true']) }),
  z.object({
    type: z.literal('sourceKind'),
    value: z.enum(['basicAttack', 'ability', 'item', 'other']),
  }),
  z.object({ type: z.literal('targetIsChampion') }),
  z.object({ type: z.literal('targetIsMonster') }),
])
export type Condition = z.infer<typeof ConditionSchema>
