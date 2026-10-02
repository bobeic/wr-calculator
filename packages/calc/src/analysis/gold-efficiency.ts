import type { Item, StatKey } from '@wr-calc/schema'

/** What one unit of a stat is worth in gold, and the item that set the price. */
export interface StatGoldValue {
  gold: number
  /** The basic or epic item the value was derived from. */
  from: string
}

export type StatGoldValues = Partial<Record<StatKey, StatGoldValue>>

const numericStats = (item: Item): Array<[StatKey, number]> =>
  (Object.entries(item.stats) as Array<[StatKey, unknown]>)
    .filter((entry): entry is [StatKey, number] => typeof entry[1] === 'number' && entry[1] !== 0)

/**
 * Prices each stat from the shop's components (League's usual gold-efficiency method). First, basic items with a
 * single stat (Long Sword: 500g / 12 AD) price their stat. Then any basic or epic item with exactly one stat still
 * unpriced prices it from what's left of its cost (Vampiric Scepter: 1200g minus 20 AD → lifesteal). Pure-stat
 * components (no effects, no named passive) go first; a component with a passive only prices a stat nothing else
 * can (Tear of the Goddess is the only mana anchor). Among several candidates, a basic item beats an epic one, then
 * the lower cost, then the id, so it's deterministic.
 */
export function statGoldValues(items: Iterable<Item>): StatGoldValues {
  const components = [...items]
    .filter((item) => (item.tier === 'basic' || item.tier === 'epic') && numericStats(item).length > 0)
    .sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'basic' ? -1 : 1) || a.cost.total - b.cost.total || a.id.localeCompare(b.id))
  const pure = components.filter((item) => item.effects.length === 0 && (item.uniquePassives ?? []).length === 0)
  const values: StatGoldValues = {}
  priceFrom(pure, values)
  priceFrom(components, values)
  return values
}

/** Prices every stat it can from the candidates, keeping prices already set. */
function priceFrom(candidates: readonly Item[], values: StatGoldValues): void {
  let progressed = true
  while (progressed) {
    progressed = false
    for (const item of candidates) {
      const stats = numericStats(item)
      const unpriced = stats.filter(([stat]) => values[stat] === undefined)
      if (unpriced.length !== 1) continue
      // Single-stat items go first: a two-stat epic waits until the single-stat round can't price anything more.
      if (stats.length > 1 && candidates.some((other) => numericStats(other).length === 1 && values[numericStats(other)[0][0]] === undefined)) continue
      const [stat, amount] = unpriced[0]
      const known = stats.reduce((sum, [other, value]) => (other === stat ? sum : sum + value * values[other]!.gold), 0)
      const gold = (item.cost.total - known) / amount
      if (gold <= 0) continue
      values[stat] = { gold, from: item.id }
      progressed = true
    }
  }
}

export interface GoldEfficiency {
  /** Gold value of the item's priced stats. */
  value: number
  cost: number
  /** value / cost; 1 means the stats alone are worth the price. Passives aren't counted. */
  efficiency: number
  /** Stats with no gold value (nothing in the shop prices them); left out of `value`. */
  unpriced: StatKey[]
}

/** An item's gold efficiency from its stats alone. */
export function goldEfficiency(item: Item, values: StatGoldValues): GoldEfficiency {
  let value = 0
  const unpriced: StatKey[] = []
  for (const [stat, amount] of numericStats(item)) {
    const price = values[stat]
    if (price === undefined) unpriced.push(stat)
    else value += amount * price.gold
  }
  return { value, cost: item.cost.total, efficiency: item.cost.total > 0 ? value / item.cost.total : 0, unpriced }
}
