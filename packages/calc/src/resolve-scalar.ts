import type { NullableScalar } from '@wr-calc/schema'
import { interpolateLevelRange } from './rules'

export interface ResolvedScalar {
  value: number
  wasNull: boolean
  usedLevelRangeInterpolation: boolean
  wasByRank: boolean
  /** The ability rank a byRank scalar was resolved at; absent when no rank was given. */
  rank?: number
  /** The byRank array's length, set alongside `rank`. */
  byRankLength?: number
}

/** Resolves any NullableScalar to a number at a given champion level and, for byRank, ability rank. */
export function resolveScalar(scalar: NullableScalar, level: number, rank?: number): ResolvedScalar {
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
    if (scalar.byLevel.length === 0) {
      return { value: 0, wasNull: true, usedLevelRangeInterpolation: false, wasByRank: false }
    }
    const index = Math.min(Math.max(Math.round(level), 1), scalar.byLevel.length) - 1
    return {
      value: scalar.byLevel[index], wasNull: false, usedLevelRangeInterpolation: false,
      wasByRank: false,
    }
  }
  // byRank: only meaningful for ability ranks, not champion-level stat resolution.
  if (rank === undefined) {
    return { value: 0, wasNull: false, usedLevelRangeInterpolation: false, wasByRank: true }
  }
  if (scalar.byRank.length === 0) {
    return { value: 0, wasNull: true, usedLevelRangeInterpolation: false, wasByRank: true }
  }
  const index = Math.min(Math.max(Math.round(rank), 1), scalar.byRank.length) - 1
  return {
    value: scalar.byRank[index], wasNull: false, usedLevelRangeInterpolation: false,
    wasByRank: true, rank, byRankLength: scalar.byRank.length,
  }
}

/** Builds a human-readable data warning for a resolved scalar, or undefined if none applies. */
export function scalarWarning(
  ownerName: string, fieldLabel: string, resolved: ResolvedScalar
): string | undefined {
  if (resolved.wasNull) return `${ownerName}: ${fieldLabel} is unverified (null)`
  if (resolved.wasByRank && resolved.rank === undefined) {
    return `${ownerName}: ${fieldLabel} uses a byRank scalar outside an ability-rank context; `
      + 'treated as 0'
  }
  // A length that doesn't match the rank means the data isn't really per-rank (e.g. per-stack
  // passives) or has an extra entry, so the picked value may be wrong.
  if (resolved.rank !== undefined && resolved.byRankLength !== resolved.rank) {
    const usedIndex = Math.min(Math.max(Math.round(resolved.rank), 1), resolved.byRankLength ?? 0)
    return `${ownerName}: ${fieldLabel} has ${resolved.byRankLength} per-rank values but the `
      + `ability is resolved at rank ${resolved.rank}; used value ${usedIndex}`
  }
  return undefined
}
