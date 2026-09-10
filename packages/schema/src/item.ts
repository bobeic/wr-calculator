import { z } from 'zod'
import { statKeyRecord } from './stat-key'
import { NullableScalarSchema } from './scalar'
import { EffectSchema } from './effect/effect'
import { ProvenanceSchema } from './provenance'

export const ItemTierSchema = z.enum([
  'basic', 'epic', 'legendary', 'boots', 'enchant', 'support', 'consumable',
])

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: ItemTierSchema,
  cost: z.object({ total: z.number(), combine: z.number() }),
  recipe: z.array(z.string()),
  stats: statKeyRecord(NullableScalarSchema),
  effects: z.array(EffectSchema),
  tags: z.array(z.string()),
  provenance: ProvenanceSchema,
})
export type Item = z.infer<typeof ItemSchema>
