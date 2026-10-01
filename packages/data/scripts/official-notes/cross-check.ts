import type { ReviewedEntry } from '../../src/patches/overlay'
import { goldensUsing, isSyncedChange } from '../patch/patch-diff'
import type { GoldenRef } from '../patch/patch-diff'
import type { Snapshot } from '../patch/snapshot'
import type { EntryRef, Flag, IdLists, SnapshotDiff, StaleRef } from '../patch/types'
import { numbersChanged } from '../patch/text-sync'
import { matchNotes, normaliseName, notesNames } from './match'
import type { CheckedEntry, CheckedLine, EntryStatus, NotesCrossCheck, OfficialNotes } from './types'

export interface CrossCheckInput {
  patch: string
  url: string
  /** null when the notes page wasn't found. */
  notes: OfficialNotes | null
  after: Snapshot
  diff: SnapshotDiff
  /** The wrpocket-based flags from flagHandModelled. */
  flags: Flag[]
  handModelled: IdLists
  covered: IdLists
  goldens: GoldenRef[]
  /** Entries already stale from an earlier patch; never auto-cleared, so their staleness carries on. */
  previousStale: StaleRef[]
}

const refKey = (ref: { kind: string; id: string }): string => `${ref.kind}\u0000${ref.id}`
const listFor = (lists: IdLists, kind: EntryRef['kind']): string[] => (kind === 'item' ? lists.items : lists.champions)

/** The numbers in a text, with thousands separators and percent signs removed: '3,300 and 25%' -> ['3300', '25']. */
export function numberTokens(text: string): string[] {
  return (text.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? [])
}

function leafTexts(value: unknown): string[] {
  if (typeof value === 'string' || typeof value === 'number') return [String(value)]
  if (Array.isArray(value)) return value.flatMap(leafTexts)
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(leafTexts)
  return []
}

function recordNumbers(after: Snapshot, ref: EntryRef): Set<string> {
  const record = ref.kind === 'item'
    ? after.items.find((entry) => entry.id === ref.id)
    : after.champions.find((entry) => entry.id === ref.id)
  return new Set(leafTexts(record).flatMap(numberTokens))
}

function entryStatus(lines: CheckedLine[]): EntryStatus {
  const numeric = lines.filter((line) => line.status !== 'no numbers')
  if (numeric.length === 0) return 'no numbers'
  const reflected = numeric.filter((line) => line.status === 'reflected').length
  if (reflected === numeric.length) return 'reflected'
  return reflected === 0 ? 'not in wrpocket' : 'partly'
}

/** Compares the official notes with the wrpocket diff: auto-clears, notes-only flags and reflected status. */
export function crossCheckNotes(input: CrossCheckInput): NotesCrossCheck {
  if (input.notes === null) {
    return { url: input.url, found: false, published: null, autoReviewed: [], notesFlags: [], mentioned: [], unmatched: [], excludedCount: 0 }
  }
  const matched = matchNotes(input.notes, input.after)
  const included = matched.filter((entry) => !entry.excluded)
  if (included.length > 0 && included.every((entry) => entry.ref === null)) {
    throw new Error(`${input.url}: none of its ${included.length} entries matched an item or champion; the names or the page layout have drifted`)
  }
  const mentioned: CheckedEntry[] = included.flatMap((entry) => {
    if (entry.ref === null) return []
    const numbers = recordNumbers(input.after, entry.ref)
    const lines: CheckedLine[] = entry.lines.map((line) => {
      const wanted = line.after === null ? [] : numberTokens(line.after)
      if (wanted.length === 0) return { ...line, status: 'no numbers' }
      return { ...line, status: wanted.every((number) => numbers.has(number)) ? 'reflected' : 'not found' }
    })
    return [{ ref: entry.ref, heading: entry.heading, status: entryStatus(lines), lines }]
  })
  // An excluded section (game mode, system...) may still describe a real change, so naming an id there blocks its auto-clear.
  const excludedKeys = matched.flatMap((entry) => (entry.excluded && entry.ref !== null ? [refKey(entry.ref)] : []))
  const blocking = new Set([...mentioned.map((entry) => refKey(entry.ref)), ...excludedKeys])
  // A renamed heading or an entry named inside another entry's line ('Items Removed') is a mention the name match
  // misses; a flag whose name appears in that text stays. Excluded sections count too, like excludedKeys above.
  const looseTexts = [
    ...matched.filter((entry) => entry.ref === null).map((entry) => entry.heading),
    ...matched.flatMap((entry) => entry.lines.map((line) => line.text)),
  ].map(normaliseName)
  const namedLoosely = (flag: Flag): boolean => notesNames(flag.name).some((name) => looseTexts.some((text) => text.includes(name)))
  const changedKeys = new Set([...input.diff.items, ...input.diff.champions, ...input.diff.removed].map(refKey))
  const isCovered = (ref: EntryRef): boolean => listFor(input.covered, ref.kind).includes(ref.id)
  const staleKeys = new Set(input.previousStale.map(refKey))

  // With nothing outside excluded sections, "not mentioned" proves nothing, so nothing is auto-cleared.
  const autoReviewed: ReviewedEntry[] = included.length === 0 ? [] : input.flags
    // The overlay syncs price, recipe and stat values from wrpocket, so "not in the notes" must not wave one through.
    // Nor a text change that moves a number: the notes don't list every change (7.3a BotRK 7% -> 6% was real).
    .filter((flag) => flag.severity === 'changed' && !blocking.has(refKey(flag)) && !staleKeys.has(refKey(flag)) && !namedLoosely(flag)
      && !(flag.kind === 'item' && flag.changes.some(isSyncedChange))
      && !flag.changes.some((change) => change.wordDiff !== undefined && numbersChanged(change.before, change.after)))
    .map((flag) => ({
      kind: flag.kind, id: flag.id,
      note: `Not in the official ${input.patch} notes (${input.url}); wrpocket-only change to ${[...new Set(flag.changes.map((change) => change.field))].join(', ')}`,
    }))
  const seen = new Set<string>()
  const notesFlags: Flag[] = mentioned
    .map((entry) => entry.ref)
    .filter((ref) => {
      const key = refKey(ref)
      if (seen.has(key)) return false
      seen.add(key)
      return listFor(input.handModelled, ref.kind).includes(ref.id) && !isCovered(ref) && !changedKeys.has(key)
    })
    .map((ref) => ({ ...ref, severity: 'notes', changes: [], goldens: goldensUsing(ref, input.goldens) }))

  return {
    url: input.url,
    found: true,
    published: input.notes.published,
    autoReviewed,
    notesFlags,
    mentioned,
    unmatched: included.filter((entry) => entry.ref === null).map((entry) => ({ section: entry.section, heading: entry.heading })),
    excludedCount: matched.length - included.length,
  }
}
