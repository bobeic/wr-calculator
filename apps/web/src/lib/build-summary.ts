import type { Build } from '@wr-calc/schema'
import type { BuildIssue, StatCatalog, StatGoldValues } from '@wr-calc/calc'
import { goldEfficiency, statGoldValues, validateBuild } from '@wr-calc/calc'
import type { DebugBuild } from './debug-state'

export interface ItemSummary {
  id: string
  name: string
  cost: number
  /** Stat gold value over cost (passives not counted); null for an unknown id. */
  efficiency: number | null
}

export interface BuildSummary {
  items: ItemSummary[]
  totalCost: number
  issues: BuildIssue[]
}

const prices = new WeakMap<StatCatalog, StatGoldValues>()
function pricesFor(catalog: StatCatalog): StatGoldValues {
  let values = prices.get(catalog)
  if (values === undefined) {
    values = statGoldValues(catalog.items.values())
    prices.set(catalog, values)
  }
  return values
}

/** The build's items with cost and stat gold efficiency, its total cost and its shop-rule issues. */
export function summarizeBuild(build: DebugBuild, catalog: StatCatalog): BuildSummary {
  const ids = [...build.items, ...(build.boots !== undefined ? [build.boots] : [])]
  const values = pricesFor(catalog)
  const items = ids.map((id): ItemSummary => {
    const item = catalog.items.get(id)
    if (!item) return { id, name: id, cost: 0, efficiency: null }
    return { id, name: item.name, cost: item.cost.total, efficiency: goldEfficiency(item, values).efficiency }
  })
  const engineBuild: Build = {
    items: build.items, runes: build.runes, inputs: build.inputs,
    ...(build.boots !== undefined ? { boots: build.boots } : {}),
    ...(build.spells !== undefined ? { spells: build.spells } : {}),
  }
  return { items, totalCost: items.reduce((sum, item) => sum + item.cost, 0), issues: validateBuild(engineBuild, catalog.items, catalog.runes) }
}
