import type { EntryRef } from '../patch/types'

/** One bullet from the notes, e.g. 'Price: 3200 → 3300'. */
export interface NotesLine {
  /** The sub-group it sits under: 'Base Stats', 'Flurry', or a champion ability title. */
  group: string | null
  text: string
  /** Split from 'Label: before → after'; null when the line has no arrow. */
  before: string | null
  after: string | null
}

/** One heading's worth of changes: a champion card or an <h4> section. */
export interface NotesEntry {
  source: 'champion-blade' | 'rich-text'
  /** The nearest <h2>/<h3> heading text; '' for champion blades. */
  section: string
  /** True inside a game-mode, system or bug-fix section: mode-only changes, never a mention. */
  excluded: boolean
  heading: string
  lines: NotesLine[]
}

/** A parsed official patch notes page. */
export interface OfficialNotes {
  patch: string
  url: string
  title: string
  published: string
  entries: NotesEntry[]
}

/** A notes entry with the item or champion it names; ref is null when unmatched or excluded. */
export interface MatchedEntry extends NotesEntry {
  ref: EntryRef | null
}
