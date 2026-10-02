import { describe, it, expect } from 'vitest'
import { diffRunesAndSpells, renderRuneSpellChanges } from '../../scripts/patch/rune-spell-diff'
import type { Snapshot } from '../../scripts/patch/snapshot'

const rune = (id: string, description: string) => ({
  id, name: { en: id }, description: { en: description }, category: { en: 'Domination' }, slot: 1, slot_order: 1, source_id: '1',
})
const spell = (id: string, description: string) => ({ id, name: { en: id }, description: { en: description }, source_id: '2' })
const snapshot = (extra: Partial<Snapshot>): Snapshot => ({ meta: { patch: 'x', updated: 'y' }, items: [], champions: [], ...extra })

describe('diffRunesAndSpells', () => {
  it('flags changed, added and removed runes and spells, with the numbers that moved', () => {
    const changes = diffRunesAndSpells(
      snapshot({ runes: [rune('brutal', 'Gain 6 AD.'), rune('gone', 'x')], spells: [spell('flash', 'Blink.')] }),
      snapshot({ runes: [rune('brutal', 'Gain 8 AD.'), rune('new', 'y')], spells: [spell('flash', 'Blink.')] }),
    )
    expect(changes.map((change) => `${change.kind} ${change.id} ${change.change}`))
      .toEqual(['rune brutal changed', 'rune new added', 'rune gone removed'])
    expect(changes[0].fields[0].numbers).toEqual([{ before: '6', after: '8' }])
    expect(renderRuneSpellChanges(changes)).toContain('- rune `brutal` (brutal): changed\n  - description: 6 → 8')
  })

  it('compares nothing when the older snapshot has no runes or spells', () => {
    expect(diffRunesAndSpells(snapshot({}), snapshot({ runes: [rune('brutal', 'x')], spells: [] }))).toEqual([])
  })
})
