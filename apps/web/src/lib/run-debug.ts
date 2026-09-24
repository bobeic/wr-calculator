import type { Build, Champion } from '@wr-calc/schema'
import type {
  ComboAction, ComboResult, Combatant, CompareBuildsResult, StatSheet, UnsupportedEffectEntry,
  UnverifiedRuleId, AbilityKey,
} from '@wr-calc/calc'
import { combatantFromChampion, combatantFromDummy, compareBuilds, simulateCombo } from '@wr-calc/calc'
import type { DebugBuild, DebugDataset, DebugState, DebugTarget } from './debug-state'
import { parseCombo, parsePriority } from './parse-combo'
import { resolveInputs } from './collect-inputs'
import { nullReport } from './null-report'
import type { NullEntry, NullSource } from './null-report'

export type Stage<T> = { ok: true; value: T } | { ok: false; error: string }

export interface DebugEnvelope {
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}

export interface DebugResult {
  sheetA: Stage<StatSheet>
  sheetB: Stage<StatSheet>
  comboA: Stage<ComboResult>
  comboB: Stage<ComboResult>
  compare: Stage<CompareBuildsResult>
  envelope: DebugEnvelope
  nulls: NullEntry[]
}

function attempt<T>(fn: () => T): Stage<T> {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Unwraps a dependency inside attempt(); a failed dependency fails the dependent stage by name.
function need<T>(name: string, stage: Stage<T>): T {
  if (!stage.ok) throw new Error(`${name} failed: ${stage.error}`)
  return stage.value
}

function mapStage<T, U>(stage: Stage<T>, fn: (value: T) => U): Stage<U> {
  return stage.ok ? { ok: true, value: fn(stage.value) } : stage
}

/** Converts a debug-page build into an engine Build, filling declared input defaults. */
export function toBuild(build: DebugBuild, dataset: DebugDataset): Build {
  const result: Build = {
    items: build.items, runes: build.runes, inputs: resolveInputs(build, dataset.catalog),
  }
  if (build.boots !== undefined) result.boots = build.boots
  return result
}

function requireChampion(dataset: DebugDataset, id: string): Champion {
  const champion = dataset.champions.get(id)
  if (!champion) throw new Error(`unknown champion '${id}'`)
  return champion
}

function targetCombatant(target: DebugTarget, dataset: DebugDataset): Combatant {
  switch (target.kind) {
    case 'preset': {
      const preset = dataset.targets.find((candidate) => candidate.id === target.presetId)
      if (!preset) throw new Error(`unknown target preset '${target.presetId}'`)
      return combatantFromDummy(preset.target)
    }
    case 'dummy':
      return combatantFromDummy({ kind: 'dummy', hp: target.hp, armor: target.armor, mr: target.mr })
    case 'champion':
      return combatantFromChampion(
        requireChampion(dataset, target.championId), target.level,
        toBuild(target.build, dataset), dataset.catalog,
      )
  }
}

function mergeEnvelopes(sources: DebugEnvelope[]): DebugEnvelope {
  const unsupported = new Map<string, UnsupportedEffectEntry>()
  const warnings = new Set<string>()
  const rules = new Set<UnverifiedRuleId>()
  for (const source of sources) {
    source.unsupportedEffects.forEach((entry) => unsupported.set(entry.id, entry))
    source.dataWarnings.forEach((warning) => warnings.add(warning))
    source.unverifiedRules.forEach((rule) => rules.add(rule))
  }
  return {
    unsupportedEffects: [...unsupported.values()],
    dataWarnings: [...warnings],
    unverifiedRules: [...rules],
  }
}

function nullSources(state: DebugState, dataset: DebugDataset): NullSource[] {
  const championIds = new Set([state.championId])
  const builds = [state.buildA, state.buildB]
  if (state.target.kind === 'champion') {
    championIds.add(state.target.championId)
    builds.push(state.target.build)
  }
  const itemIds = new Set(builds.flatMap((build) => [
    ...build.items, ...(build.boots !== undefined ? [build.boots] : []),
  ]))
  const runeIds = new Set(builds.flatMap((build) => build.runes))

  const sources: NullSource[] = []
  for (const id of championIds) {
    const champion = dataset.champions.get(id)
    if (champion) sources.push({ label: `champion ${id}`, value: champion })
  }
  for (const id of itemIds) {
    const item = dataset.catalog.items.get(id)
    if (item) sources.push({ label: `item ${id}`, value: item })
  }
  for (const id of runeIds) {
    const rune = dataset.catalog.runes.get(id)
    if (rune) sources.push({ label: `rune ${id}`, value: rune })
  }
  return sources
}

/** Runs every engine stage for the debug page, isolating failures so one broken stage never blanks the others. */
export function runDebug(state: DebugState, dataset: DebugDataset): DebugResult {
  const champion = attempt(() => requireChampion(dataset, state.championId))
  const attackerA = attempt(() => combatantFromChampion(
    need('champion', champion), state.level, toBuild(state.buildA, dataset), dataset.catalog,
  ))
  const attackerB = attempt(() => combatantFromChampion(
    need('champion', champion), state.level, toBuild(state.buildB, dataset), dataset.catalog,
  ))
  const target = attempt(() => targetCombatant(state.target, dataset))

  const comboParse = parseCombo(state.combo)
  const combo: Stage<ComboAction[]> = comboParse.ok
    ? { ok: true, value: comboParse.actions } : { ok: false, error: comboParse.error }
  const priorityParse = parsePriority(state.priority)
  const priority: Stage<AbilityKey[]> = priorityParse.ok
    ? { ok: true, value: priorityParse.keys } : { ok: false, error: priorityParse.error }

  const runCombo = (name: string, attacker: Stage<Combatant>) => attempt(() => simulateCombo(
    need(name, attacker), need('target', target), need('combo text', combo),
    { critMode: state.critMode },
  ))
  const comboA = runCombo('build A', attackerA)
  const comboB = runCombo('build B', attackerB)

  const compare = attempt(() => {
    need('build A', attackerA)
    need('build B', attackerB)
    const side = (build: DebugBuild) => ({
      champion: need('champion', champion), level: state.level,
      build: toBuild(build, dataset), catalog: dataset.catalog,
    })
    return compareBuilds(side(state.buildA), side(state.buildB), need('target', target), {
      durationSeconds: state.durationSeconds,
      priority: need('priority text', priority),
      burstSequence: need('combo text', combo),
    })
  })

  const sheetA = mapStage(attackerA, (combatant) => combatant.sheet)
  const sheetB = mapStage(attackerB, (combatant) => combatant.sheet)
  const envelopeSources: DebugEnvelope[] = [
    sheetA, sheetB, mapStage(target, (combatant) => combatant.sheet), comboA, comboB, compare,
  ].flatMap((stage) => (stage.ok ? [stage.value] : []))

  return {
    sheetA, sheetB, comboA, comboB, compare,
    envelope: mergeEnvelopes(envelopeSources),
    nulls: nullReport(nullSources(state, dataset)),
  }
}
