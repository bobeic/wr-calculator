import { z } from 'zod'
import { ConditionSchema } from '../condition'

export const SupportLevelSchema = z.enum(['full', 'partial', 'none'])
export type SupportLevel = z.infer<typeof SupportLevelSchema>

/** A user-controlled parameter the UI renders automatically for a declaring effect. */
export const EffectInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stackCount'),
    id: z.string(),
    label: z.string(),
    min: z.number(),
    max: z.number(),
    default: z.number(),
  }).strict(),
  z.object({
    type: z.literal('boolean'),
    id: z.string(),
    label: z.string(),
    default: z.boolean(),
  }).strict(),
])
export type EffectInput = z.infer<typeof EffectInputSchema>

/**
 * Fields shared by every Effect kind; individual kinds `.extend()` this. `.strict()` here
 * cascades to every kind schema (`extend()` preserves the base's unknown-keys mode), so this
 * is the one place that needs it.
 */
export const EffectBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  uniqueGroup: z.string().optional(),
  support: SupportLevelSchema,
  supportNotes: z.string().optional(),
  inputs: z.array(EffectInputSchema).optional(),
  condition: ConditionSchema.optional(),
}).strict()
