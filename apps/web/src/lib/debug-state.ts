import type { Champion } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'
import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import type { TargetPreset } from '@wr-calc/data'

export interface DebugBuild {
  items: string[]
  boots?: string
  runes: string[]
  inputs: Record<string, number | boolean>
}

export type DebugTarget =
  | { kind: 'preset'; presetId: string }
  | { kind: 'dummy'; hp: number; armor: number; mr: number }
  | { kind: 'champion'; championId: string; level: number; build: DebugBuild }

/** Ability ranks for the attacking champion; a slot left out is at its max rank. */
export type AbilityRanks = Partial<Record<'q' | 'w' | 'e' | 'r', number>>
export const RANK_SLOTS = ['q', 'w', 'e', 'r'] as const

export type CritMode = 'expected' | 'always' | 'never'
export const CRIT_MODES: readonly CritMode[] = ['expected', 'always', 'never']

/** Upper bound on combo/sustainedDps duration: simulation cost grows linearly with it. */
export const MAX_DURATION_SECONDS = 120

export interface DebugState {
  championId: string
  level: number
  abilityRanks: AbilityRanks
  buildA: DebugBuild
  buildB: DebugBuild
  target: DebugTarget
  combo: string
  priority: string
  durationSeconds: number
  critMode: CritMode
}

export interface DebugDataset {
  champions: Map<string, Champion>
  catalog: StatCatalog
  targets: TargetPreset[]
}

/** Returns a new build with no items, boots, runes or inputs. */
export function emptyBuild(): DebugBuild {
  return { items: [], runes: [], inputs: {} }
}

/** Returns the state an empty URL decodes to. */
export function defaultState(dataset: DebugDataset): DebugState {
  const championId: string | undefined = [...dataset.champions.keys()][0]
  const presetId: string | undefined = dataset.targets[0]?.id
  if (championId === undefined || presetId === undefined) {
    throw new Error('defaultState: dataset needs at least one champion and one target preset')
  }
  return {
    championId,
    level: MAX_CHAMPION_LEVEL,
    abilityRanks: {},
    buildA: emptyBuild(),
    buildB: emptyBuild(),
    target: { kind: 'preset', presetId },
    combo: 'AA',
    priority: 'Q W E R',
    durationSeconds: 10,
    critMode: 'expected',
  }
}
