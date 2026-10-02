import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { DamageComponentSchema } from '../../damage-component'

/**
 * Charges that each empower one basic attack: extra damage (`bonus`, same format as ability
 * damage) and optional attack speed for that swing. Granted by an ability cast, or by a dash
 * within `withinSeconds` of a cast's end (treated as 0 when omitted). Charges share one expiry,
 * refreshed on every grant.
 */
export const EmpoweredAttackEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('empoweredAttack'),
  grant: z.object({
    on: z.enum(['abilityCast', 'dashAfterAbility']),
    slots: z.array(z.enum(['q', 'w', 'e', 'r'])).optional(),
    withinSeconds: z.number().nonnegative().optional(),
    /** Charges one grant adds (default 1), e.g. Lee Sin's Iron Will empowers the next two attacks. */
    charges: z.number().int().positive().optional(),
  }).strict(),
  maxCharges: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  bonus: DamageComponentSchema,
  attackSpeedBonus: z.number().nonnegative().optional(),
})
export type EmpoweredAttackEffect = z.infer<typeof EmpoweredAttackEffectSchema>
