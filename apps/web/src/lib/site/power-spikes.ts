import { MAX_CHAMPION_LEVEL, buildBreakpoints } from '@wr-calc/calc'
import { CURRENT_DATASET } from '../dataset'
import { DEFAULT_COMBO } from '../calculator'
import { parseCombo } from '../parse-combo'
import { targetCombatant, toBuild } from '../run-debug'

// The champion-page setup: the calculator's defaults (max level, its combo) against the bruiser preset, so a squishy
// dying to the first combo doesn't flatten every step.
export const SPIKE_TARGET = 'bruiser'
const target = targetCombatant({ kind: 'preset', presetId: SPIKE_TARGET }, CURRENT_DATASET)
const combo = parseCombo(DEFAULT_COMBO)

/**
 * The default combo's damage after each item of a core, in buying order: where the build spikes. One number per
 * item; empty when the champion or combo can't be simulated.
 */
export function powerSpikes(championId: string, items: string[], runes: string[]): number[] {
  const champion = CURRENT_DATASET.champions.get(championId)
  if (champion === undefined || !combo.ok || items.length === 0) return []
  const build = toBuild({ items, runes, inputs: {} }, CURRENT_DATASET, {}, champion)
  const { breakpoints } = buildBreakpoints(
    { champion, level: MAX_CHAMPION_LEVEL, build, catalog: CURRENT_DATASET.catalog }, target,
    { durationSeconds: 10, priority: ['q', 'w', 'e', 'r'], burstSequence: combo.actions },
  )
  return breakpoints.map((breakpoint) => breakpoint.burst)
}
