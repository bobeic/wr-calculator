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
  // Known only to ability cast/hit hooks (e.g. a burn applied when the ultimate hits), not to
  // per-damage-instance checks like damageAmp.
  z.object({ type: z.literal('abilitySlot'), value: z.enum(['q', 'w', 'e', 'r']) }).strict(),
  // True while the target has an active dot from the effect's owner. Known only during combat, so
  // stat effects gated on it are applied by the combat simulation rather than stat resolution.
  z.object({ type: z.literal('targetHasDot') }).strict(),
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
