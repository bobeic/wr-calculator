import { normalizeId } from '../wrpocket/ids'
import { ATTACK_SPEED_COLUMN, SLOTS, STAT_COLUMNS } from '../wrpocket/map-champion'
import type { Snapshot, SnapshotChampion, SnapshotItem } from './snapshot'
import { diffWords, numberChanges, renderWordDiff } from './text-diff'
import type { EntryDiff, EntryRef, FieldChange, IdLists, SnapshotDiff } from './types'

const MISSING = '—'
const SLOT_BY_KEY = new Map(SLOTS.map(([slot, key]) => [key, slot]))
const STAT_BY_COLUMN = new Map<string, string>([
  ...STAT_COLUMNS.map(([stat, column]): [string, string] => [column, stat]),
  [ATTACK_SPEED_COLUMN, 'attackSpeed'],
])

function valueChange(field: string, before: string | undefined, after: string | undefined): FieldChange[] {
  if (before === after) return []
  return [{ field, before: before ?? MISSING, after: after ?? MISSING }]
}

function textChange(field: string, before: string | undefined, after: string | undefined): FieldChange[] {
  if (before === undefined || after === undefined || before === after) return valueChange(field, before, after)
  const ops = diffWords(before, after)
  return [{ field, before, after, numbers: numberChanges(ops), wordDiff: renderWordDiff(ops) }]
}

function unionKeys(...records: Array<Record<string, unknown> | undefined>): string[] {
  return [...new Set(records.flatMap((record) => Object.keys(record ?? {})))].sort()
}

function diffItem(before: SnapshotItem, after: SnapshotItem): FieldChange[] {
  return [
    ...textChange('name', before.name.en, after.name.en),
    ...textChange('description', before.description.en, after.description.en),
    ...valueChange('price', before.price, after.price),
    ...valueChange('tier', before.tier, after.tier),
    ...valueChange('category', before.category.en, after.category.en),
    ...valueChange('components', before.components.join(', '), after.components.join(', ')),
    ...unionKeys(before.numeric_stats, after.numeric_stats).flatMap((key) => valueChange(
      `stats.${key}`, before.numeric_stats[key]?.toString(), after.numeric_stats[key]?.toString(),
    )),
  ]
}

const levelNumber = (key: string): number => Number(/(\d+)$/.exec(key)?.[1] ?? Number.NaN)

function diffChampionStats(before: SnapshotChampion, after: SnapshotChampion): FieldChange[] {
  const levels = unionKeys(before.stats, after.stats).sort((a, b) => levelNumber(a) - levelNumber(b))
  const columns = unionKeys(...levels.flatMap((level) => [before.stats[level], after.stats[level]]))
  return columns.flatMap((column) => {
    const changed = levels.filter((level) => before.stats[level]?.[column] !== after.stats[level]?.[column])
    if (changed.length === 0) return []
    const describe = (stats: SnapshotChampion['stats']): string => changed
      .map((level) => `Lv${levelNumber(level)} ${stats[level]?.[column] ?? MISSING}`).join(', ')
    return [{ field: `stats.${STAT_BY_COLUMN.get(column) ?? column}`, before: describe(before.stats), after: describe(after.stats) }]
  })
}

/** Keys scaling rows by type; a repeated type gets '#2', '#3', ... so the first row keeps the plain name the mapper reads. */
function scalingByOccurrence(rows: Array<{ type: string; value: string }>): Record<string, string> {
  const seen = new Map<string, number>()
  return Object.fromEntries(rows.map((row): [string, string] => {
    const count = (seen.get(row.type) ?? 0) + 1
    seen.set(row.type, count)
    return [count === 1 ? row.type : `${row.type}#${count}`, row.value]
  }))
}

function diffChampion(before: SnapshotChampion, after: SnapshotChampion): FieldChange[] {
  const abilityChanges = unionKeys(before.abilities, after.abilities).flatMap((key) => {
    const label = SLOT_BY_KEY.get(key) ?? key
    const a = before.abilities[key]
    const b = after.abilities[key]
    if (a === undefined || b === undefined) {
      return valueChange(label, a?.name.en, b?.name.en)
    }
    const scalingA = scalingByOccurrence(a.scaling)
    const scalingB = scalingByOccurrence(b.scaling)
    return [
      ...textChange(`${label}.name`, a.name.en, b.name.en),
      ...textChange(`${label}.description`, a.description.en, b.description.en),
      ...unionKeys(scalingA, scalingB).flatMap((type) => valueChange(
        `${label}.scaling.${type}`, scalingA[type], scalingB[type],
      )),
    ]
  })
  return [
    ...textChange('name', before.name.en, after.name.en),
    ...diffChampionStats(before, after),
    ...abilityChanges,
  ]
}

function diffEntries<T extends { id: string; name: { en: string } }>(
  kind: EntryDiff['kind'], before: T[], after: T[], diffOne: (a: T, b: T) => FieldChange[],
): { changed: EntryDiff[]; added: EntryRef[]; removed: EntryRef[] } {
  const ref = (entry: T): EntryRef => ({ kind, id: normalizeId(entry.id), name: entry.name.en })
  const beforeById = new Map(before.map((entry) => [entry.id, entry]))
  const afterIds = new Set(after.map((entry) => entry.id))
  const changed: EntryDiff[] = []
  const added: EntryRef[] = []
  for (const entry of after) {
    const previous = beforeById.get(entry.id)
    if (previous === undefined) {
      added.push(ref(entry))
      continue
    }
    const changes = diffOne(previous, entry)
    if (changes.length > 0) changed.push({ ...ref(entry), changes })
  }
  const removed = before.filter((entry) => !afterIds.has(entry.id)).map(ref)
  return { changed, added, removed }
}

/** Compares two snapshots record by record, keyed by this repo's ids. */
export function diffSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff {
  const items = diffEntries('item', before.items, after.items, diffItem)
  const champions = diffEntries('champion', before.champions, after.champions, diffChampion)
  return {
    items: items.changed,
    champions: champions.changed,
    added: [...items.added, ...champions.added],
    removed: [...items.removed, ...champions.removed],
  }
}

/** Ids whose record changed or disappeared (not added ones), sorted. */
export function changedIdsOf(diff: SnapshotDiff): IdLists {
  const ids = (kind: EntryDiff['kind'], changed: EntryDiff[]): string[] => [
    ...changed.map((entry) => entry.id),
    ...diff.removed.filter((entry) => entry.kind === kind).map((entry) => entry.id),
  ].sort()
  return { items: ids('item', diff.items), champions: ids('champion', diff.champions) }
}
