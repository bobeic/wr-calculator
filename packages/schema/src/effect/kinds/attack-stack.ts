import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'

/**
 * A self buff built by basic attacks: each counted attack adds a stack after it lands, each stack grants
 * `amountPerStack` of `stat` (bonus layer), and every new stack refreshes the duration (e.g. Phantom Dancer's
 * attack speed). With `every`/`startAt`, only attacks number startAt, startAt + every, ... count (Terminus's Dark
 * attacks: every 2, starting at 2). With `cooldownSeconds`, the buff can't be gained again until the cooldown,
 * which starts when it's gained, ends (Yun Tal's Flurry).
 */
export const AttackStackEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('attackStack'),
  stat: StatKeySchema,
  amountPerStack: z.number(),
  maxStacks: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  every: z.number().int().positive().optional(),
  startAt: z.number().int().positive().optional(),
  cooldownSeconds: z.number().nonnegative().optional(),
})
export type AttackStackEffect = z.infer<typeof AttackStackEffectSchema>
