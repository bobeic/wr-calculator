import { CURRENT_PATCH, buildChampionMap, getPatchDataset } from '@wr-calc/data'
import type { DebugDataset } from './debug-state'

/** A patch's data in the shape the debug page consumes. */
export function datasetFor(patch: string): DebugDataset {
  const dataset = getPatchDataset(patch)
  return { champions: buildChampionMap(dataset.champions), catalog: dataset.catalog, targets: dataset.targets }
}

/** The newest imported patch: what the debug page shows. */
export const CURRENT_DATASET: DebugDataset = datasetFor(CURRENT_PATCH)
