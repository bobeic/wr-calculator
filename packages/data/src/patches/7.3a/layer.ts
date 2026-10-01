import type { PatchLayer } from '../overlay'
import { CHANGED_IDS } from './generated/changed-ids'
import { GENERATED_CHAMPIONS } from './generated/champions'
import { GENERATED_ITEMS } from './generated/items'
import { NOTES_FLAGGED, NOTES_REVIEWED } from './generated/notes-review'
import { OVERRIDE_CHAMPIONS, OVERRIDE_ITEMS } from './overrides'
import { REVIEWED } from './reviewed'

/** Patch 7.3a: regenerated wrpocket data over the previous patch's hand-modelled entries. */
export const PATCH_LAYER: PatchLayer = {
  id: '7.3a',
  generatedItems: GENERATED_ITEMS,
  generatedChampions: GENERATED_CHAMPIONS,
  overrideItems: OVERRIDE_ITEMS,
  overrideChampions: OVERRIDE_CHAMPIONS,
  reviewed: [...REVIEWED, ...NOTES_REVIEWED],
  changedIds: {
    items: [...CHANGED_IDS.items, ...NOTES_FLAGGED.items],
    champions: [...CHANGED_IDS.champions, ...NOTES_FLAGGED.champions],
  },
}
