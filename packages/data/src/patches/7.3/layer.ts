import type { PatchLayer } from '../overlay'
import { HAND_MODELED_CHAMPIONS } from './champions'
import { EXCLUSIVE_GROUPS } from './exclusive-groups'
import { GENERATED_CHAMPIONS } from './generated/champions'
import { GENERATED_ITEMS } from './generated/items'
import { STARTER_ITEMS } from './items'
import { PATCH_7_3_TARGETS } from './targets'

/** Patch 7.3, the root layer: its hand-modelled entries, groups and targets seed every later patch. */
export const PATCH_LAYER: PatchLayer = {
  id: '7.3',
  generatedItems: GENERATED_ITEMS,
  generatedChampions: GENERATED_CHAMPIONS,
  overrideItems: STARTER_ITEMS,
  overrideChampions: HAND_MODELED_CHAMPIONS,
  reviewed: [],
  changedIds: { items: [], champions: [] },
  exclusiveGroups: EXCLUSIVE_GROUPS,
  targets: PATCH_7_3_TARGETS,
}
