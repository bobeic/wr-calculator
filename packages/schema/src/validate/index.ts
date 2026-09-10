import type { Item } from '../item'
import {
  validateItemCost, validateRecipeIds, validateUniqueGroups, validateItemHandlers,
} from './item'

export {
  validateItemCost, validateRecipeIds, validateUniqueGroups, validateItemHandlers,
}

/** Runs every structural and cross-field check for a single item. */
export function validateItem(
  item: Item,
  allItems: Map<string, Item>,
  knownHandlerIds: Set<string>
): string[] {
  return [
    ...validateItemCost(item, allItems),
    ...validateRecipeIds(item, allItems),
    ...validateUniqueGroups(item),
    ...validateItemHandlers(item, knownHandlerIds),
  ]
}
