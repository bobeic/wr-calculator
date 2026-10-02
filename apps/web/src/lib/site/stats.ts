import type { Item, StatKey } from '@wr-calc/schema'

const LABELS: Record<StatKey, string> = {
  hp: 'Health', hpRegen: 'Health regen', mana: 'Mana', manaRegen: 'Mana regen', ad: 'Attack damage', ap: 'Ability power',
  armor: 'Armor', mr: 'Magic resist', attackSpeed: 'Attack speed', critChance: 'Crit chance', critDamage: 'Crit damage',
  abilityHaste: 'Ability haste', basicAbilityHaste: 'Basic ability haste', ultimateHaste: 'Ultimate haste',
  moveSpeed: 'Move speed', moveSpeedPct: 'Move speed', flatArmorPen: 'Armor pen', pctArmorPen: 'Armor pen',
  flatMagicPen: 'Magic pen', pctMagicPen: 'Magic pen', lifesteal: 'Lifesteal', physicalVamp: 'Physical vamp',
  omnivamp: 'Omnivamp', healShieldPower: 'Heal and shield power', tenacity: 'Tenacity',
}

// Stats stored as fractions (0.3 = 30%).
const PERCENT: ReadonlySet<StatKey> = new Set([
  'attackSpeed', 'critChance', 'critDamage', 'moveSpeedPct', 'pctArmorPen', 'pctMagicPen', 'lifesteal', 'physicalVamp',
  'omnivamp', 'healShieldPower', 'tenacity',
])

/** An item's stats as display rows, e.g. ['Attack speed', '+30%']. Level-scaling or missing values show as text. */
export function statRows(stats: Item['stats']): Array<[string, string]> {
  return (Object.entries(stats) as Array<[StatKey, Item['stats'][StatKey]]>).map(([key, value]) => {
    if (typeof value !== 'number') return [LABELS[key], value === null ? 'unknown' : 'scales with level']
    const amount = PERCENT.has(key) ? `${Math.round(value * 1000) / 10}%` : String(Math.round(value * 100) / 100)
    return [LABELS[key], `+${amount}`]
  })
}

export const TIER_ORDER: Item['tier'][] = ['legendary', 'boots', 'support', 'epic', 'basic', 'enchant', 'consumable']
export const TIER_LABELS: Record<Item['tier'], string> = {
  legendary: 'Legendary', boots: 'Boots', support: 'Support', epic: 'Epic', basic: 'Basic', enchant: 'Enchant', consumable: 'Consumable',
}

/** How far the calculator models an item: 'full', 'partial', 'stats only' (no passive effects) or 'not modelled'. */
export function modelStatus(item: Item): 'full' | 'partial' | 'stats only' | 'passive not modelled' {
  if (item.effects.length > 0) return item.effects.every((effect) => effect.support === 'full') ? 'full' : 'partial'
  return (item.uniquePassives ?? []).length > 0 ? 'passive not modelled' : 'stats only'
}
