import { describe, it, expect } from 'vitest'
import { mapSnapshot } from '../../scripts/patch/map-snapshot'
import { makeRawChampion, makeRawItem, makeSnapshot } from './fixtures'

const PROVENANCE = { source: 'wiki' as const, patch: '7.3a', verifiedInGame: false }

describe('mapSnapshot', () => {
  it('maps items and champions with the given provenance and our ids', () => {
    const snapshot = makeSnapshot('7.3a', 'u', [makeRawItem({ id: 'b.-f.-sword', price: '1300' })], [makeRawChampion()])
    const mapped = mapSnapshot(snapshot, PROVENANCE)
    expect(mapped.items.map((item) => item.id)).toEqual(['bf-sword'])
    expect(mapped.items[0].provenance).toEqual(PROVENANCE)
    expect(mapped.champions[0].baseStats.hp).toEqual({ base: 500, perLevel: 100 })
  })

  it('returns notes as subject/note pairs sorted by subject', () => {
    const snapshot = makeSnapshot('7.3a', 'u', [makeRawItem({ tier: 'mystery' })], [makeRawChampion()])
    const { notes } = mapSnapshot(snapshot, PROVENANCE)
    expect(notes).toContainEqual({ subject: 'item long-sword', note: "unknown tier 'mystery', treated as legendary" })
    expect(notes.map((note) => note.subject)).toEqual([...notes.map((note) => note.subject)].sort((a, b) => a.localeCompare(b)))
  })
})
