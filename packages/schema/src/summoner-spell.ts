import { z } from 'zod'
import { EffectSchema } from './effect/effect'

/** A summoner spell. Its damage comes from an `active` effect, cast with a `spell:<id>` combo action. */
export const SummonerSpellSchema = z.object({
  id: z.string(),
  name: z.string(),
  effects: z.array(EffectSchema),
}).strict()
export type SummonerSpell = z.infer<typeof SummonerSpellSchema>
