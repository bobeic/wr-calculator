import type { NullableScalar } from '@wr-calc/schema'
import { interpolateLevelRange } from './rules'

export interface ResolvedScalar {
  value: number
  wasNull: boolean
  usedLevelRangeInterpolation: boolean
  wasByRank: boolean
}

/** Resolves any NullableScalar to a number at a given champion level. */
export function resolveScalar(scalar: NullableScalar, level: number): ResolvedScalar {
  if (scalar === null) {
    return { value: 0, wasNull: true, usedLevelRangeInterpolation: false, wasByRank: false }
  }
  if (typeof scalar === 'number') {
    return { value: scalar, wasNull: false, usedLevelRangeInterpolation: false, wasByRank: false }
  }
  if ('levelRange' in scalar) {
    const value = interpolateLevelRange(scalar.levelRange.min, scalar.levelRange.max, level)
    return { value, wasNull: false, usedLevelRangeInterpolation: true, wasByRank: false }
  }
  if ('byLevel' in scalar) {
    const index = Math.min(Math.max(Math.round(level), 1), scalar.byLevel.length) - 1
    return {
      value: scalar.byLevel[index], wasNull: false, usedLevelRangeInterpolation: false,
      wasByRank: false,
    }
  }
  // byRank: only meaningful for ability ranks, not champion-level stat resolution.
  return { value: 0, wasNull: false, usedLevelRangeInterpolation: false, wasByRank: true }
}

/** Builds a human-readable data warning for a resolved scalar, or undefined if none applies. */
export function scalarWarning(
  ownerName: string, fieldLabel: string, resolved: ResolvedScalar
): string | undefined {
  if (resolved.wasNull) return `${ownerName}: ${fieldLabel} is unverified (null)`
  if (resolved.wasByRank) {
    return `${ownerName}: ${fieldLabel} uses a byRank scalar outside an ability-rank context; `
      + 'treated as 0'
  }
  return undefined
}
