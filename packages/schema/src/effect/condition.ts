import { z } from 'zod'

const LEAF_CONDITIONS = [
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
] as const

/** A single, non-combined condition. */
export const LeafConditionSchema = z.discriminatedUnion('type', [...LEAF_CONDITIONS])
export type LeafCondition = z.infer<typeof LeafConditionSchema>

/**
 * The closed set of conditions an Effect may gate on. No string expressions, no eval.
 * `allOf` holds only leaf conditions (no nesting), which keeps the schema non-recursive.
 */
export const ConditionSchema = z.discriminatedUnion('type', [
  ...LEAF_CONDITIONS,
  z.object({
    type: z.literal('allOf'), conditions: z.array(LeafConditionSchema).min(2),
  }).strict(),
])
export type Condition = z.infer<typeof ConditionSchema>
