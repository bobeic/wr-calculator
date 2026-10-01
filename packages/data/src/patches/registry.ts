import { PATCH_LAYERS } from './layers'
import { buildPatchDatasets } from './overlay'
import type { PatchDataset } from './overlay'

/** Every patch with data, oldest first. */
export const PATCH_IDS: readonly string[] = PATCH_LAYERS.map((layer) => layer.id)

/** The newest imported patch: the app's default. */
export const CURRENT_PATCH: string = PATCH_IDS[PATCH_IDS.length - 1]

let datasets: Map<string, PatchDataset> | null = null

/** Returns a patch's dataset, building every patch's dataset on first use. */
export function getPatchDataset(id: string): PatchDataset {
  datasets ??= buildPatchDatasets(PATCH_LAYERS)
  const dataset = datasets.get(id)
  if (dataset === undefined) throw new Error(`unknown patch '${id}' (known: ${PATCH_IDS.join(', ')})`)
  return dataset
}
