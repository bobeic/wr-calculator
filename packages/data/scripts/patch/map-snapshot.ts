import type { Champion, Item, Provenance } from '@wr-calc/schema'
import { mapChampion } from '../wrpocket/map-champion'
import { mapItem } from '../wrpocket/map-item'
import { RawChampionSchema, RawItemSchema } from '../wrpocket/raw-schemas'
import type { Snapshot } from './snapshot'
import type { NoteRef } from './types'

export interface MappedSnapshot {
  items: Item[]
  champions: Champion[]
  notes: NoteRef[]
}

/** Maps a snapshot to engine items and champions with the existing mapper, collecting its notes. */
export function mapSnapshot(snapshot: Snapshot, provenance: Provenance): MappedSnapshot {
  const rawItems = snapshot.items.map((item) => RawItemSchema.parse(item))
  const rawChampions = snapshot.champions.map((champion) => RawChampionSchema.parse(champion))
  const prices = new Map(rawItems.map((item) => [item.id, Number(item.price)]))
  const items = rawItems.map((raw) => mapItem(raw, prices, provenance))
  const champions = rawChampions.map((raw) => mapChampion(raw, provenance))
  const notes = [
    ...champions.map(({ value, notes: list }) => ({ subject: `champion ${value.id}`, list })),
    ...items.map(({ value, notes: list }) => ({ subject: `item ${value.id}`, list })),
  ]
    .sort((a, b) => a.subject.localeCompare(b.subject))
    .flatMap(({ subject, list }) => list.map((note) => ({ subject, note })))
  return {
    items: items.map(({ value }) => value),
    champions: champions.map(({ value }) => value),
    notes,
  }
}
