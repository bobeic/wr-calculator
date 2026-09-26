import { z } from 'zod'
import { BuildSchema } from './build'
import { EffectSchema } from './effect/effect'

export const TargetChampionSchema = z.object({
  kind: z.literal('champion'),
  champion: z.string(),
  level: z.number(),
  build: BuildSchema,
}).strict()

export const TargetDummySchema = z.object({
  kind: z.literal('dummy'),
  hp: z.number(),
  armor: z.number(),
  mr: z.number(),
  /** Fraction of max HP the dummy starts the combo at (defaults to 1, full HP). */
  startHpFraction: z.number().gt(0).max(1).optional(),
  effects: z.array(EffectSchema).optional(),
}).strict()

export const TargetSchema = z.discriminatedUnion('kind', [TargetChampionSchema, TargetDummySchema])
export type Target = z.infer<typeof TargetSchema>
