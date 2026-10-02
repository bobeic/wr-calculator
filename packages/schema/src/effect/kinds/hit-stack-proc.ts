import { z } from 'zod'
import { ScalarSchema } from '../../scalar'
import { EffectBaseSchema } from './common'
import { DamageComponentSchema } from '../../damage-component'

/**
 * Stacks on the target, at most one per hit (a basic attack or an ability stage cast) of a kind
 * in `stacksFrom`. Reaching `stacksToProc` spends them, deals `damage` (instantly, or per tick
 * as damage over time) and starts the cooldown; no stacks build while it's on cooldown
 * (e.g. Eclipse, Serylda's Grudge's Frostbite).
 */
export const HitStackProcEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('hitStackProc'),
  stacksToProc: z.number().int().min(2),
  /** Stacks expire this long after the latest one. */
  stackWindowSeconds: z.number().positive(),
  /** May scale with level (e.g. Electrocute's 20-13 seconds). */
  cooldownSeconds: ScalarSchema,
  /** Deal the damage as adaptive (physical or magic by the owner's stats) instead of `damage.type`. */
  adaptive: z.boolean().optional(),
  /** `empoweredAttack` is an attack that spent an empowered-attack charge; `basicAttack` is any attack. */
  stacksFrom: z.array(z.enum(['basicAttack', 'ability', 'empoweredAttack'])).min(1),
  damage: DamageComponentSchema,
  delivery: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('instant') }).strict(),
    z.object({
      kind: z.literal('dot'),
      tickIntervalSeconds: z.number().positive(),
      durationSeconds: z.number().positive(),
    }).strict(),
  ]),
})
export type HitStackProcEffect = z.infer<typeof HitStackProcEffectSchema>
