import type { Champion, Item, Provenance } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'
import { buildCatalog, mergeById, withExclusiveGroups } from '../catalog'
import type { TargetPreset } from './7.3/targets'
import { syncItem } from './source-sync'

/** Ids of every source record that changed or disappeared since the previous patch. */
export interface ChangedIds {
  items: string[]
  champions: string[]
}

/** A flagged entry checked for this patch and found unaffected, with what was checked. */
export interface ReviewedEntry {
  kind: 'item' | 'champion'
  id: string
  note: string
}

/** One effect number taken from wrpocket's description text, confirmed by the official notes (generated/text-sync.ts). */
export interface TextUpdate {
  itemId: string
  /** Omitted for a field on the item itself, e.g. path 'stats.critDamage'. */
  effectId?: string
  /** Path inside the effect (or the item), e.g. 'pctTargetCurrentHp' or 'ratios[0].value'. */
  path: string
  value: number
  /** The description numbers it came from, for the report: '7% -> 6%'. */
  note: string
}

/** Everything one patch folder contributes to its dataset. */
export interface PatchLayer {
  id: string
  generatedItems: Item[]
  generatedChampions: Champion[]
  /** Hand-modelled entries written for this patch; they replace inherited ones by id. */
  overrideItems: Item[]
  overrideChampions: Champion[]
  reviewed: ReviewedEntry[]
  changedIds: ChangedIds
  /** Effect numbers updated from wrpocket text; applied to inherited hand-modelled items before overrides. */
  textSync?: TextUpdate[]
  /** Replaces the inherited groups when set; required on the root patch. */
  exclusiveGroups?: Record<string, string>
  /** Replaces the inherited targets when set; required on the root patch. */
  targets?: TargetPreset[]
}

/** One patch's data as the engine and app consume it. */
export interface PatchDataset {
  id: string
  items: Item[]
  champions: Champion[]
  catalog: StatCatalog
  targets: TargetPreset[]
  exclusiveGroups: Record<string, string>
  /** Effective hand-modelled entries without stale marks; the next patch inherits these. */
  handModelled: { items: Item[]; champions: Champion[] }
  /** Hand-modelled id -> the patch it went stale in. */
  stale: { items: Map<string, string>; champions: Map<string, string> }
}

function nextStale(
  patch: string, inherited: Array<{ id: string }>, previous: Map<string, string>, changed: string[], covered: Set<string>,
): Map<string, string> {
  const stale = new Map([...previous].filter(([id]) => !covered.has(id)))
  const inheritedIds = new Set(inherited.map((entry) => entry.id))
  for (const id of changed) {
    if (inheritedIds.has(id) && !covered.has(id) && !stale.has(id)) stale.set(id, patch)
  }
  return stale
}

function markStale<T extends { id: string; provenance: Provenance }>(entries: T[], stale: Map<string, string>): T[] {
  return entries.map((entry) => {
    const since = stale.get(entry.id)
    return since === undefined ? entry : { ...entry, provenance: { ...entry.provenance, verifiedInGame: false, staleSince: since } }
  })
}

function setPath(target: Record<string, unknown>, path: string, value: number): void {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let node: Record<string, unknown> = target
  for (const key of keys.slice(0, -1)) {
    const next = node[key]
    if (typeof next !== 'object' || next === null) throw new Error(`text sync path ${path} does not exist`)
    node = next as Record<string, unknown>
  }
  const last = keys[keys.length - 1]
  if (typeof node[last] !== 'number') throw new Error(`text sync path ${path} is not a number`)
  node[last] = value
}

/** Applies text-sync updates to copies of the items they name; an update for an unknown item or effect throws. */
export function applyTextSync(items: Item[], updates: TextUpdate[]): Item[] {
  if (updates.length === 0) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const changed = new Map<string, Item>()
  for (const update of updates) {
    const item = changed.get(update.itemId) ?? byId.get(update.itemId)
    if (item === undefined) throw new Error(`text sync names unknown item ${update.itemId}`)
    const copy: Item = changed.get(update.itemId) ?? structuredClone(item)
    const target = update.effectId === undefined ? copy : copy.effects.find((entry) => entry.id === update.effectId)
    if (target === undefined) throw new Error(`text sync names unknown effect ${update.effectId} on ${update.itemId}`)
    setPath(target as unknown as Record<string, unknown>, update.path, update.value)
    changed.set(update.itemId, copy)
  }
  return items.map((item) => changed.get(item.id) ?? item)
}

/** Builds a patch's dataset from its layer over the previous patch's dataset (null for the root). */
export function buildPatchDataset(layer: PatchLayer, previous: PatchDataset | null): PatchDataset {
  if (previous === null && (layer.exclusiveGroups === undefined || layer.targets === undefined)) {
    throw new Error(`root patch ${layer.id} must define exclusiveGroups and targets`)
  }
  const covered = (kind: ReviewedEntry['kind'], overrides: Array<{ id: string }>): Set<string> => new Set([
    ...overrides.map((entry) => entry.id),
    ...layer.reviewed.filter((entry) => entry.kind === kind).map((entry) => entry.id),
  ])
  const inheritedItems = previous?.handModelled.items ?? []
  const inheritedChampions = previous?.handModelled.champions ?? []
  const stale = {
    items: nextStale(layer.id, inheritedItems, previous?.stale.items ?? new Map(), layer.changedIds.items, covered('item', layer.overrideItems)),
    champions: nextStale(layer.id, inheritedChampions, previous?.stale.champions ?? new Map(), layer.changedIds.champions, covered('champion', layer.overrideChampions)),
  }
  const handModelled = {
    items: mergeById(applyTextSync(inheritedItems, layer.textSync ?? []), layer.overrideItems),
    champions: mergeById(inheritedChampions, layer.overrideChampions),
  }
  const generatedById = new Map(layer.generatedItems.map((entry) => [entry.id, entry]))
  // A stale item's new wrpocket values are unconfirmed, so it keeps the values it last had; it syncs again once covered.
  const previousItems = new Map((previous?.items ?? []).map((entry) => [entry.id, entry]))
  const syncedItems = handModelled.items.map((entry) => {
    const kept = stale.items.has(entry.id) ? previousItems.get(entry.id) : undefined
    return syncItem(entry, kept ?? generatedById.get(entry.id))
  })
  const merged = mergeById(layer.generatedItems, markStale(syncedItems, stale.items))
  // Inherited groups drop ids wrpocket removed (the report lists the removal); a layer's own groups stay strict.
  const presentIds = new Set(merged.map((entry) => entry.id))
  const exclusiveGroups = layer.exclusiveGroups ?? Object.fromEntries(
    Object.entries(previous?.exclusiveGroups ?? {}).filter(([id]) => presentIds.has(id)),
  )
  const items = withExclusiveGroups(merged, exclusiveGroups)
  return {
    id: layer.id,
    items,
    champions: mergeById(layer.generatedChampions, markStale(handModelled.champions, stale.champions)),
    catalog: buildCatalog(items, []),
    targets: layer.targets ?? previous?.targets ?? [],
    exclusiveGroups,
    handModelled,
    stale,
  }
}

/** Builds every layer's dataset in order, each over the one before it. */
export function buildPatchDatasets(layers: PatchLayer[]): Map<string, PatchDataset> {
  const datasets = new Map<string, PatchDataset>()
  let previous: PatchDataset | null = null
  for (const layer of layers) {
    previous = buildPatchDataset(layer, previous)
    datasets.set(layer.id, previous)
  }
  return datasets
}
