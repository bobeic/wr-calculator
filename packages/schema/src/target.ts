import { z } from 'zod'
import { BuildSchema } from './build'
import { EffectSchema } from './effect/effect'

export const TargetChampionSchema = z.object({
  kind: z.literal('champion'),
  champion: z.string(),
  level: z.number(),
  build: BuildSchema,
})

export const TargetDummySchema = z.object({
  kind: z.literal('dummy'),
  hp: z.number(),
  armor: z.number(),
  mr: z.number(),
  effects: z.array(EffectSchema).optional(),
})

export const TargetSchema = z.discriminatedUnion('kind', [TargetChampionSchema, TargetDummySchema])
export type Target = z.infer<typeof TargetSchema>
