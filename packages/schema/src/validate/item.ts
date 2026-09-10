import type { Item } from '../item'

/** Checks cost.total === sum(component totals) + combine. */
export function validateItemCost(item: Item, allItems: Map<string, Item>): string[] {
  const errors: string[] = []
  const componentTotal = item.recipe.reduce((sum, id) => {
    const component = allItems.get(id)
    if (!component) return sum // reported separately by validateRecipeIds
    return sum + component.cost.total
  }, 0)
  if (componentTotal + item.cost.combine !== item.cost.total) {
    errors.push(
      `Item ${item.id}: cost.total (${item.cost.total}) !== sum(components)=${componentTotal} + combine=${item.cost.combine}`
    )
  }
  return errors
}

/** Checks every recipe component id resolves to a known item. */
export function validateRecipeIds(item: Item, allItems: Map<string, Item>): string[] {
  return item.recipe
    .filter((id) => !allItems.has(id))
    .map((id) => `Item ${item.id}: recipe references unknown item id '${id}'`)
}

/** Checks no two distinct effects on the same item accidentally share a uniqueGroup. */
export function validateUniqueGroups(item: Item): string[] {
  const errors: string[] = []
  const seenBy = new Map<string, string>()
  for (const effect of item.effects) {
    if (!effect.uniqueGroup) continue
    const existing = seenBy.get(effect.uniqueGroup)
    if (existing && existing !== effect.id) {
      errors.push(
        `Item ${item.id}: effects '${existing}' and '${effect.id}' both declare uniqueGroup '${effect.uniqueGroup}'`
      )
    }
    seenBy.set(effect.uniqueGroup, effect.id)
  }
  return errors
}

/**
 * Checks every custom-effect handler id is registered. Takes the known handler ids as a
 * parameter rather than importing packages/calc, so this package stays dependency-free; the
 * real handler registry is threaded in by the caller.
 */
export function validateItemHandlers(item: Item, knownHandlerIds: Set<string>): string[] {
  const errors: string[] = []
  for (const effect of item.effects) {
    if (effect.kind === 'custom' && !knownHandlerIds.has(effect.handler)) {
      errors.push(`Item ${item.id}: unknown custom handler '${effect.handler}'`)
    }
  }
  return errors
}
