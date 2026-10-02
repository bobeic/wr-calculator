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
  cost: z.object({ total: z.number(), combine: z.number() }).strict(),
  recipe: z.array(z.string()),
  stats: statKeyRecord(NullableScalarSchema),
  effects: z.array(EffectSchema),
  tags: z.array(z.string()),
  /** A build may hold at most one item from each exclusive group (a shop restriction). */
  exclusiveGroup: z.string().optional(),
  /**
   * Names of the item's named passives and actives, e.g. ['Spellblade']. A build may hold at most one finished
   * item with a given name (user, 2026-10-02: "passives are unique"); components don't count.
   */
  uniquePassives: z.array(z.string()).optional(),
  /**
   * Hand-modelled items only: fields kept as written instead of taken from the patch's imported data,
   * e.g. 'cost', 'recipe', 'stats.ad'. Each pin needs a comment naming the better source (notes, in-game).
   */
  sourcePins: z.array(z.string()).optional(),
  provenance: ProvenanceSchema,
}).strict()
export type Item = z.infer<typeof ItemSchema>
