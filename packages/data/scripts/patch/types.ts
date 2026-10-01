import type { TextUpdate } from '../../src/patches/overlay'
import type { NotesCrossCheck } from '../official-notes/types'

export type EntryKind = 'item' | 'champion'

/** A number that changed inside a text field, e.g. 7% -> 6%; '' when one side has no partner. */
export interface NumberChange {
  before: string
  after: string
}

/** One changed field. Text fields carry the numbers that changed and a markdown word diff. */
export interface FieldChange {
  field: string
  before: string
  after: string
  numbers?: NumberChange[]
  wordDiff?: string
}

/** Identifies an item or champion by this repo's id. */
export interface EntryRef {
  kind: EntryKind
  id: string
  name: string
}

export interface EntryDiff extends EntryRef {
  changes: FieldChange[]
}

/** The raw record-by-record comparison of two snapshots. */
export interface SnapshotDiff {
  items: EntryDiff[]
  champions: EntryDiff[]
  added: EntryRef[]
  removed: EntryRef[]
}

/** Item and champion id lists, e.g. the ids a patch changed or covered. */
export interface IdLists {
  items: string[]
  champions: string[]
}

/** A hand-modelled entry that needs review in this patch; 'notes' = changed in the official notes only. */
export interface Flag extends EntryRef {
  severity: 'removed' | 'changed' | 'notes'
  changes: FieldChange[]
  goldens: string[]
}

/** A hand-modelled entry that went stale in an earlier patch and is still unresolved. */
export interface StaleRef extends EntryRef {
  since: string
}

/** One importer note, e.g. subject 'champion annie'. */
export interface NoteRef {
  subject: string
  note: string
}

export type ReportedDiff = EntryDiff & { goldens: string[] }

/** Everything PATCH_DIFF.md and patch-diff.json report for one patch. */
export interface PatchDiff {
  from: string
  to: string
  fromUpdated: string
  toUpdated: string
  needsReview: Flag[]
  /** Hand-modelled items whose changes were all applied from wrpocket by the overlay's source sync; no review needed. */
  autoApplied: ReportedDiff[]
  /** Effect numbers the auto-applied items took from wrpocket's text; written to generated/text-sync.ts. */
  textSync: TextUpdate[]
  carriedStale: StaleRef[]
  items: ReportedDiff[]
  champions: ReportedDiff[]
  added: EntryRef[]
  removed: EntryRef[]
  mapperNotes: { added: NoteRef[]; removed: NoteRef[] }
  /** The official notes cross-check; null when no notes stage ran. */
  officialNotes: NotesCrossCheck | null
}
