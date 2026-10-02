import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { DamageComponentSchema } from '../../damage-component'

/**
 * Damage dealt to the opponent every `tickIntervalSeconds` while in combat (e.g. Sunfire Aegis's Immolate).
 * Combat starts with the owner's first damage; the first tick lands one interval later. Ticks stop once
 * `combatWindowSeconds` pass without the owner dealing other damage.
 */
export const CombatAuraEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('combatAura'),
  damage: DamageComponentSchema,
  tickIntervalSeconds: z.number().positive(),
  combatWindowSeconds: z.number().positive(),
})
export type CombatAuraEffect = z.infer<typeof CombatAuraEffectSchema>
