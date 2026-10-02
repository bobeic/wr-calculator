import type { StatRatio } from '@wr-calc/schema'
import type { StatSheet } from '../resolve-stats'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

/** Sums `stat × value` over the ratios, reading each ratio's layer (total when omitted) of the sheet. */
export function sumStatRatios(
  ratios: readonly StatRatio[], sheet: StatSheet, level: number, ownerName: string, warn: (message: string) => void,
): number {
  let amount = 0
  for (const ratio of ratios) {
    const resolved = resolveScalar(ratio.value, level)
    const warning = scalarWarning(ownerName, `ratios.${ratio.stat}`, resolved)
    if (warning) warn(warning)
    amount += (sheet[ratio.layer ?? 'total'][ratio.stat] ?? 0) * resolved.value
  }
  return amount
}
