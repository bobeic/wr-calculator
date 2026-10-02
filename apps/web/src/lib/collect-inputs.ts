import type { Champion, Effect, EffectInput } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'
import { championKitEffects } from '@wr-calc/calc'
import type { DebugBuild } from './debug-state'

function buildEffects(build: DebugBuild, catalog: StatCatalog, champion?: Champion): Effect[] {
  const itemIds = [...build.items, ...(build.boots !== undefined ? [build.boots] : [])]
  return [
    ...(champion !== undefined ? championKitEffects(champion) : []),
    ...itemIds.flatMap((id) => catalog.items.get(id)?.effects ?? []),
    ...build.runes.flatMap((id) => catalog.runes.get(id)?.effects ?? []),
    ...(build.spells ?? []).flatMap((id) => catalog.spells?.get(id)?.effects ?? []),
  ]
}

/**
 * Lists the effect inputs the champion's kit (when given) and the build's items, boots, runes and spells declare,
 * deduped by input id (first wins).
 */
export function collectInputs(build: DebugBuild, catalog: StatCatalog, champion?: Champion): EffectInput[] {
  const byId = new Map<string, EffectInput>()
  for (const effect of buildEffects(build, catalog, champion)) {
    for (const input of effect.inputs ?? []) {
      if (!byId.has(input.id)) byId.set(input.id, input)
    }
  }
  return [...byId.values()]
}

/** Returns an input's current value, or its declared default when unset. */
export function inputValue(
  input: EffectInput, values: Record<string, number | boolean>,
): number | boolean {
  return values[input.id] ?? input.default
}

/** Returns the build's input values with every declared input's default filled in. */
export function resolveInputs(
  build: DebugBuild, catalog: StatCatalog, champion?: Champion,
): Record<string, number | boolean> {
  // The engine reads a missing input as 0/false rather than its declared default.
  const defaults: Record<string, number | boolean> = {}
  for (const input of collectInputs(build, catalog, champion)) defaults[input.id] = input.default
  return { ...defaults, ...build.inputs }
}
