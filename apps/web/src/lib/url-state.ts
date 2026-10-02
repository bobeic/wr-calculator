import { z } from 'zod'
import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import type { DebugBuild, DebugDataset, DebugState, DebugTarget } from './debug-state'
import { CRIT_MODES, MAX_DURATION_SECONDS, defaultState, emptyBuild } from './debug-state'

/** Read-only view of query params; URLSearchParams and Next's ReadonlyURLSearchParams both fit. */
export interface QueryParams {
  get(name: string): string | null
}

const BuildParamSchema = z.object({
  items: z.array(z.string()),
  boots: z.string().optional(),
  runes: z.array(z.string()),
  spells: z.array(z.string()).optional(),
  inputs: z.record(z.string(), z.union([z.number(), z.boolean()])),
}).strict()

const RanksParamSchema = z.object({
  q: z.number().int().min(1).optional(),
  w: z.number().int().min(1).optional(),
  e: z.number().int().min(1).optional(),
  r: z.number().int().min(1).optional(),
}).strict()

const TargetParamSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preset'), presetId: z.string() }).strict(),
  z.object({
    kind: z.literal('dummy'), hp: z.number().positive(), armor: z.number(), mr: z.number(),
  }).strict(),
  z.object({
    kind: z.literal('champion'),
    championId: z.string(),
    level: z.number().int().min(1).max(MAX_CHAMPION_LEVEL),
    build: BuildParamSchema,
  }).strict(),
])

/** Serializes the full debug state into a query string (no leading '?'). */
export function encodeState(state: DebugState): string {
  const params = new URLSearchParams()
  params.set('champ', state.championId)
  params.set('lvl', String(state.level))
  if (Object.keys(state.abilityRanks).length > 0) params.set('ranks', JSON.stringify(state.abilityRanks))
  params.set('a', JSON.stringify(state.buildA))
  params.set('b', JSON.stringify(state.buildB))
  params.set('t', JSON.stringify(state.target))
  params.set('combo', state.combo)
  params.set('prio', state.priority)
  params.set('dur', String(state.durationSeconds))
  params.set('crit', state.critMode)
  return params.toString()
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function decodeNumber(
  raw: string | null, label: string, fallback: number, valid: (value: number) => boolean,
  issues: string[],
): number {
  if (raw === null) return fallback
  const value = Number(raw)
  // Number('') is 0, so a blank value must be rejected explicitly.
  if (raw.trim() === '' || !Number.isFinite(value) || !valid(value)) {
    issues.push(`${label}: invalid value '${raw}', reset to default`)
    return fallback
  }
  return value
}

function sanitizeBuild(
  build: DebugBuild, label: string, dataset: DebugDataset, issues: string[],
): DebugBuild {
  const known = (id: string, kind: 'item' | 'boots' | 'rune' | 'spell'): boolean => {
    const catalog = kind === 'rune' ? dataset.catalog.runes : kind === 'spell' ? dataset.catalog.spells : dataset.catalog.items
    if (catalog?.has(id)) return true
    issues.push(`${label}: unknown ${kind} '${id}' dropped`)
    return false
  }
  const items = build.items.filter((id) => known(id, 'item'))
  const sanitized: DebugBuild = { items, runes: [], inputs: build.inputs }
  if (build.boots !== undefined && known(build.boots, 'boots')) sanitized.boots = build.boots
  sanitized.runes = build.runes.filter((id) => known(id, 'rune'))
  const spells = (build.spells ?? []).filter((id) => known(id, 'spell'))
  if (spells.length > 0) sanitized.spells = spells
  return sanitized
}

function decodeBuild(
  raw: string | null, label: string, dataset: DebugDataset, issues: string[],
): DebugBuild {
  if (raw === null) return emptyBuild()
  const parsed = BuildParamSchema.safeParse(parseJson(raw))
  if (!parsed.success) {
    issues.push(`${label}: malformed, reset to empty`)
    return emptyBuild()
  }
  return sanitizeBuild(parsed.data, label, dataset, issues)
}

function decodeTarget(
  raw: string | null, fallback: DebugTarget, dataset: DebugDataset, issues: string[],
): DebugTarget {
  if (raw === null) return fallback
  const parsed = TargetParamSchema.safeParse(parseJson(raw))
  if (!parsed.success) {
    issues.push('target: malformed, reset to default')
    return fallback
  }
  const target = parsed.data
  if (target.kind === 'preset' && !dataset.targets.some((preset) => preset.id === target.presetId)) {
    issues.push(`target: unknown preset '${target.presetId}', reset to default`)
    return fallback
  }
  if (target.kind === 'champion') {
    if (!dataset.champions.has(target.championId)) {
      issues.push(`target: unknown champion '${target.championId}', reset to default`)
      return fallback
    }
    return { ...target, build: sanitizeBuild(target.build, 'target build', dataset, issues) }
  }
  return target
}

/** Decodes query params into a full debug state; never throws, reporting every value it had to reset or drop. */
export function decodeState(
  params: QueryParams, dataset: DebugDataset,
): { state: DebugState; issues: string[] } {
  const defaults = defaultState(dataset)
  const issues: string[] = []

  let championId = defaults.championId
  const champ = params.get('champ')
  if (champ !== null) {
    if (dataset.champions.has(champ)) championId = champ
    else issues.push(`unknown champion '${champ}', reset to default`)
  }

  const level = decodeNumber(
    params.get('lvl'), 'level', defaults.level,
    (value) => Number.isInteger(value) && value >= 1 && value <= MAX_CHAMPION_LEVEL, issues,
  )
  let abilityRanks = defaults.abilityRanks
  const ranks = params.get('ranks')
  if (ranks !== null) {
    const parsed = RanksParamSchema.safeParse(parseJson(ranks))
    if (parsed.success) abilityRanks = parsed.data
    else issues.push('ability ranks: malformed, reset to max rank')
  }
  const buildA = decodeBuild(params.get('a'), 'build A', dataset, issues)
  const buildB = decodeBuild(params.get('b'), 'build B', dataset, issues)
  const target = decodeTarget(params.get('t'), defaults.target, dataset, issues)
  const durationSeconds = decodeNumber(
    params.get('dur'), 'duration', defaults.durationSeconds,
    (value) => value > 0 && value <= MAX_DURATION_SECONDS, issues,
  )

  let critMode = defaults.critMode
  const crit = params.get('crit')
  if (crit !== null) {
    const mode = CRIT_MODES.find((candidate) => candidate === crit)
    if (mode) critMode = mode
    else issues.push(`unknown crit mode '${crit}', reset to default`)
  }

  return {
    state: {
      championId, level, abilityRanks, buildA, buildB, target,
      combo: params.get('combo') ?? defaults.combo,
      priority: params.get('prio') ?? defaults.priority,
      durationSeconds, critMode,
    },
    issues,
  }
}
