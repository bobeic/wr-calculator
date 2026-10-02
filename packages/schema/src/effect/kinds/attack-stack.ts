import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { ScalarSchema } from '../../scalar'

/**
 * A self buff built by hits: each counted hit adds a stack after it lands, each stack grants `amountPerStack` of
 * `stat` (bonus layer), and every new stack refreshes the duration (e.g. Phantom Dancer's attack speed). `stacksFrom`
 * picks the hits that count: basic attacks (the default) and/or ability stage casts (Conqueror). With `adaptive`,
 * each stack grants AD or AP instead, by the owner's stats (Conqueror: 3-5 AD or 5-8.33 AP). With `every`/`startAt`,
 * only hits number startAt, startAt + every, ... count (Terminus's Dark attacks: every 2, starting at 2). With
 * `cooldownSeconds`, the buff can't be gained again until the cooldown, which starts when it's gained, ends (Yun
 * Tal's Flurry). Give either `stat` and `amountPerStack`, or `adaptive`.
 */
export const AttackStackEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('attackStack'),
  stat: StatKeySchema.optional(),
  amountPerStack: ScalarSchema.optional(),
  adaptive: z.object({ ad: ScalarSchema, ap: ScalarSchema }).strict().optional(),
  stacksFrom: z.array(z.enum(['basicAttack', 'ability'])).min(1).optional(),
  maxStacks: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  every: z.number().int().positive().optional(),
  startAt: z.number().int().positive().optional(),
  cooldownSeconds: z.number().nonnegative().optional(),
})
export type AttackStackEffect = z.infer<typeof AttackStackEffectSchema>
