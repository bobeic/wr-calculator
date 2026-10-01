import { z } from 'zod'

export const STAT_KEYS = [
  'hp', 'hpRegen', 'mana', 'manaRegen', 'ad', 'ap', 'armor', 'mr',
  'attackSpeed', 'critChance', 'critDamage', 'abilityHaste', 'basicAbilityHaste', 'ultimateHaste',
  'moveSpeed', 'moveSpeedPct', 'flatArmorPen', 'pctArmorPen',
  'flatMagicPen', 'pctMagicPen', 'lifesteal', 'physicalVamp',
  'omnivamp', 'healShieldPower', 'tenacity',
] as const

/** The closed set of stat keys the engine understands; unknown keys fail validation. */
export const StatKeySchema = z.enum(STAT_KEYS)
export type StatKey = z.infer<typeof StatKeySchema>

/** Builds a Partial<Record<StatKey, T>> schema for the given per-stat value schema. */
export function statKeyRecord<T extends z.ZodTypeAny>(valueSchema: T) {
  const shape = Object.fromEntries(
    STAT_KEYS.map((key) => [key, valueSchema.optional()])
  ) as Record<StatKey, z.ZodOptional<T>>
  return z.object(shape).strict()
}
