import type { Snapshot } from '../patch/snapshot'
import type { EntryRef } from '../patch/types'
import { htmlToText } from './parse'
import type { MatchedEntry, OfficialNotes } from './types'

// Known naming differences between the notes and wrpocket, by normalised name.
const ALIASES: Record<string, string> = {
  'lord dominiks regards': 'dominiks regards',
  'at wits end': 'wits end',
  'staff of flowing waters': 'staff of flowing water',
}

/** Normalises a display name for matching: case, quotes, entities and punctuation folded away. */
export function normaliseName(name: string): string {
  return htmlToText(name).toLowerCase().replace(/['']/g, "'").replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

/** The normalised names the notes may use for an entry: its own, plus every alias that maps to it. */
export function notesNames(name: string): string[] {
  const own = normaliseName(name)
  return [own, ...Object.keys(ALIASES).filter((alias) => ALIASES[alias] === own)]
}

function index(kind: EntryRef['kind'], entries: Array<{ id: string; name: { en: string } }>): Map<string, EntryRef> {
  return new Map(entries.map((entry) => [normaliseName(entry.name.en), { kind, id: entry.id, name: entry.name.en }]))
}

/** Pairs each notes entry, excluded ones included, with the item or champion it names in the snapshot, or null. */
export function matchNotes(notes: OfficialNotes, snapshot: Snapshot): MatchedEntry[] {
  const items = index('item', snapshot.items)
  const champions = index('champion', snapshot.champions)
  return notes.entries.map((entry) => {
    const name = normaliseName(entry.heading)
    const key = ALIASES[name] ?? name
    const ref = entry.source === 'champion-blade' ? champions.get(key) : items.get(key) ?? champions.get(key)
    return { ...entry, ref: ref ?? null }
  })
}
