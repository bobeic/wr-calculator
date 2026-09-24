import {
  PATCH_7_3_CATALOG, PATCH_7_3_CHAMPIONS, PATCH_7_3_TARGETS, buildChampionMap,
} from '@wr-calc/data'
import type { DebugDataset } from './debug-state'

export const PATCH_7_3_DATASET: DebugDataset = {
  champions: buildChampionMap(PATCH_7_3_CHAMPIONS),
  catalog: PATCH_7_3_CATALOG,
  targets: PATCH_7_3_TARGETS,
}
