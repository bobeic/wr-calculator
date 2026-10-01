import type { LoadedGoldenCase } from '../../src/golden-loader'
import { crossCheckNotes } from '../official-notes/cross-check'
import type { NotesCrossCheck, OfficialNotes } from '../official-notes/types'
import { diffSnapshots, MISSING } from './diff'
import type { Snapshot } from './snapshot'
import type { EntryDiff, EntryRef, FieldChange, Flag, IdLists, NoteRef, PatchDiff, ReportedDiff, SnapshotDiff, StaleRef } from './types'

/** What a golden case touches, for matching against changed entries. */
export interface GoldenRef {
  file: string
  championId: string
  itemIds: string[]
}

/** Extracts each golden case's champion and build item ids (boots and enchant included). */
export function goldenRefs(cases: LoadedGoldenCase[]): GoldenRef[] {
  return cases.map(({ file, case: goldenCase }) => {
    const { items, boots, enchant } = goldenCase.scenario.build
    return {
      file,
      championId: goldenCase.scenario.championId,
      itemIds: [...items, ...[boots, enchant].filter((id): id is string => id !== undefined)],
    }
  })
}

/** Golden case files that use the given entry, sorted. */
export function goldensUsing(ref: EntryRef, goldens: GoldenRef[]): string[] {
  return goldens
    .filter((golden) => (ref.kind === 'champion' ? golden.championId === ref.id : golden.itemIds.includes(ref.id)))
    .map((golden) => golden.file)
    .sort()
}

const compareRefs = (a: EntryRef, b: EntryRef): number => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)

// Item diff fields the overlay takes from wrpocket for hand-modelled items (see src/patches/source-sync.ts).
const SYNCED_DIFF_FIELDS = new Set(['name', 'price', 'tier', 'components'])

/** True when the overlay's source sync applies a change to a hand-modelled item: a synced field, or a stat that changed value. */
export function isSyncedChange(change: FieldChange): boolean {
  if (SYNCED_DIFF_FIELDS.has(change.field)) return true
  return change.field.startsWith('stats.') && change.before !== MISSING && change.after !== MISSING
}

/**
 * Flagged items whose every change the overlay's source sync applies, confirmed by the official notes: the notes
 * mention the item and every new number in them shows up in wrpocket. wrpocket sometimes carries CN-only or
 * regressed values (7.3a BotRK), so an unconfirmed change stays flagged. Pinned items are never auto-applied.
 */
export function autoAppliedItems(flags: Flag[], officialNotes: NotesCrossCheck | null, pinnedItems: string[]): Flag[] {
  if (officialNotes === null || !officialNotes.found) return []
  const pinned = new Set(pinnedItems)
  const confirmed = new Set(officialNotes.mentioned
    .filter((entry) => entry.ref.kind === 'item' && entry.status === 'reflected').map((entry) => entry.ref.id))
  return flags.filter((flag) => flag.kind === 'item' && flag.severity === 'changed' && !pinned.has(flag.id)
    && confirmed.has(flag.id) && flag.changes.every(isSyncedChange))
}

/** Flags hand-modelled entries that changed or disappeared and are not covered; removed ones first. */
export function flagHandModelled(diff: SnapshotDiff, handModelled: IdLists, covered: IdLists, goldens: GoldenRef[]): Flag[] {
  const listFor = (lists: IdLists, kind: EntryRef['kind']): Set<string> => new Set(kind === 'item' ? lists.items : lists.champions)
  const needsFlag = (ref: EntryRef): boolean => listFor(handModelled, ref.kind).has(ref.id) && !listFor(covered, ref.kind).has(ref.id)
  const removed: Flag[] = diff.removed.filter(needsFlag).sort(compareRefs)
    .map((ref) => ({ ...ref, severity: 'removed', changes: [], goldens: goldensUsing(ref, goldens) }))
  const changed: Flag[] = [...diff.items, ...diff.champions].filter(needsFlag).sort(compareRefs)
    .map((entry) => ({ ...entry, severity: 'changed', goldens: goldensUsing(entry, goldens) }))
  return [...removed, ...changed]
}

export interface BuildPatchDiffInput {
  before: Snapshot
  after: Snapshot
  /** The previous patch's effective hand-modelled ids. */
  handModelled: IdLists
  /** Entries already stale in the previous patch. */
  previousStale: StaleRef[]
  /** Ids overridden or reviewed in the new patch. */
  covered: IdLists
  goldens: GoldenRef[]
  notesBefore: NoteRef[]
  notesAfter: NoteRef[]
  /** The official notes for the new patch; null when no notes stage ran. */
  notes: { url: string; notes: OfficialNotes | null } | null
  /** Turns on auto-apply of notes-confirmed synced item changes; pinnedItems are hand-modelled items with sourcePins. Omitted: everything is flagged. */
  autoApply?: { pinnedItems: string[] }
}

const noteKey = (note: NoteRef): string => `${note.subject}\u0000${note.note}`

/** Builds the full report data for one patch: flags, carried staleness, diffs with goldens, note changes. */
export function buildPatchDiff(input: BuildPatchDiffInput): PatchDiff {
  const diff = diffSnapshots(input.before, input.after)
  const flags = flagHandModelled(diff, input.handModelled, input.covered, input.goldens)
  const officialNotes = input.notes === null ? null : crossCheckNotes({
    patch: input.after.meta.patch, url: input.notes.url, notes: input.notes.notes, after: input.after, diff,
    flags, handModelled: input.handModelled, covered: input.covered, goldens: input.goldens, previousStale: input.previousStale,
  })
  const autoApplied = input.autoApply === undefined ? [] : autoAppliedItems(flags, officialNotes, input.autoApply.pinnedItems)
  const resolved = new Set([...(officialNotes?.autoReviewed ?? []), ...autoApplied].map((entry) => `${entry.kind}\u0000${entry.id}`))
  const needsReview = [...flags.filter((flag) => !resolved.has(`${flag.kind}\u0000${flag.id}`)), ...(officialNotes?.notesFlags ?? [])]
  const withGoldens = (entries: EntryDiff[]): ReportedDiff[] =>
    entries.map((entry) => ({ ...entry, goldens: goldensUsing(entry, input.goldens) }))
  const coveredIds = (kind: EntryRef['kind']): Set<string> => new Set(kind === 'item' ? input.covered.items : input.covered.champions)
  const flagged = new Set(needsReview.map((flag) => `${flag.kind}\u0000${flag.id}`))
  const beforeKeys = new Set(input.notesBefore.map(noteKey))
  const afterKeys = new Set(input.notesAfter.map(noteKey))
  return {
    from: input.before.meta.patch,
    to: input.after.meta.patch,
    fromUpdated: input.before.meta.updated,
    toUpdated: input.after.meta.updated,
    needsReview,
    autoApplied: autoApplied.map(({ kind, id, name, changes, goldens }) => ({ kind, id, name, changes, goldens })),
    carriedStale: input.previousStale
      .filter((entry) => !coveredIds(entry.kind).has(entry.id) && !flagged.has(`${entry.kind}\u0000${entry.id}`)).sort(compareRefs),
    items: withGoldens(diff.items),
    champions: withGoldens(diff.champions),
    added: diff.added,
    removed: diff.removed,
    mapperNotes: {
      added: input.notesAfter.filter((note) => !beforeKeys.has(noteKey(note))),
      removed: input.notesBefore.filter((note) => !afterKeys.has(noteKey(note))),
    },
    officialNotes,
  }
}
