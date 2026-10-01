import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { htmlToText, parseChangeLine, parseNotesPage } from '../../scripts/official-notes/parse'
import { notesUrl } from '../../scripts/official-notes/url'

const fixture = (patch: string): string =>
  readFileSync(new URL(`../fixtures/official-notes/${patch}.html`, import.meta.url), 'utf-8')

describe('notesUrl', () => {
  it('turns dots into dashes', () => {
    expect(notesUrl('7.3a')).toBe('https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-7-3a/')
  })
})

describe('htmlToText', () => {
  it('strips tags, decodes entities and collapses whitespace', () => {
    expect(htmlToText('<meta>Diadem of Songs&nbsp; <i>x</i> &amp; Kai&#39;Sa &#x2019;')).toBe("Diadem of Songs x & Kai'Sa ’")
  })
})

describe('parseChangeLine', () => {
  it.each([
    ['Price: 3200 → 3300', '3200', '3300'],
    ['3200 → 3300', '3200', '3300'],
    ['Armor and Magic Resistance gained after a plate falls: 30→20', '30', '20'],
    ['Health per level：128 → 136', '128', '136'],
    ['Trigger distance: 7 → 11。', '7', '11'],
    ['Health Restored: 3% - 4.5% + 0.5% Ability Power -> 4.5% - 6% + 0.2% Ability Power', '3% - 4.5% + 0.5% Ability Power', '4.5% - 6% + 0.2% Ability Power'],
    ['Armor per level：5 → 5.5', '5', '5.5'],
  ])('splits %j', (text, before, after) => {
    expect(parseChangeLine(text)).toEqual({ before, after })
  })

  it('returns nulls for a line with no arrow', () => {
    expect(parseChangeLine('[New] Tenacity: 20%')).toEqual({ before: null, after: null })
  })
})

describe('parseNotesPage on 7.3a', () => {
  const notes = parseNotesPage(fixture('7.3a'), '7.3a', 'https://example.test/7-3a')

  it('reads the masthead', () => {
    expect(notes).toMatchObject({ patch: '7.3a', url: 'https://example.test/7-3a', title: 'Wild Rift Patch Notes 7.3a', published: '2026-09-29T09:00:00.000Z' })
  })

  it('reads champion cards with ability titles as groups', () => {
    const hwei = notes.entries.find((entry) => entry.heading === 'HWEI')
    expect(hwei).toMatchObject({ source: 'champion-blade', section: '', excluded: false })
    expect(hwei?.lines[0].group).toBe('Signature of the Visionary')
    expect(notes.entries.filter((entry) => entry.source === 'champion-blade')).toHaveLength(12)
  })

  it('reads item entries under ITEMS with their groups', () => {
    const yunTal = notes.entries.find((entry) => entry.heading === 'Yun Tal Wildarrows')
    expect(yunTal).toMatchObject({ source: 'rich-text', section: 'ITEMS', excluded: false })
    expect(yunTal?.lines).toEqual([
      { group: 'Base Stats', text: 'Attack Speed: 25% → 35%', before: '25%', after: '35%' },
      { group: 'Flurry', text: 'Attack Speed: 25% → 35%', before: '25%', after: '35%' },
      { group: 'Flurry', text: 'Cooldown: 20s → 25s', before: '20s', after: '25s' },
    ])
    expect(notes.entries.find((entry) => entry.heading === "Death's Dance")?.lines.map((line) => line.after)).toEqual(['3300'])
  })

  it('trims entity padding from headings', () => {
    expect(notes.entries.map((entry) => entry.heading)).toContain('Diadem of Songs')
  })

  it('marks game-mode entries excluded', () => {
    const excluded = notes.entries.filter((entry) => entry.excluded).map((entry) => entry.heading)
    expect(excluded).toEqual(['Augment Adjustments', 'Champion Adjustment'])
  })

  it('has 18 entries in all', () => {
    expect(notes.entries).toHaveLength(18)
  })
})

describe('parseNotesPage on 7.3', () => {
  const notes = parseNotesPage(fixture('7.3'), '7.3', 'https://example.test/7-3')

  it('reads several rich-text and champion blades in page order', () => {
    expect(notes.entries).toHaveLength(197)
    expect(notes.entries.filter((entry) => entry.excluded)).toHaveLength(23)
  })

  it('treats a wholly italic paragraph as a group header and skips commentary', () => {
    const lastWhisper = notes.entries.find((entry) => entry.heading === 'Last Whisper')
    expect(lastWhisper?.lines[0]).toEqual({ group: 'Base Stats', text: '[New] Build Path: Long Sword (500) + 700', before: null, after: null })
    const zeal = notes.entries.find((entry) => entry.heading === 'Zeal')
    expect(zeal?.lines).toEqual([{ group: 'Base Stats', text: 'Movement Speed: 5% → 4%', before: '5%', after: '4%' }])
  })
})

describe('parseNotesPage errors', () => {
  it('throws without __NEXT_DATA__', () => {
    expect(() => parseNotesPage('<html></html>', '7.3a', 'u')).toThrow(/no __NEXT_DATA__/)
  })

  it('throws when no change blades are present', () => {
    const page = '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"page":{"blades":[{"type":"riotbar"}]}}}}</script>'
    expect(() => parseNotesPage(page, '7.3a', 'u')).toThrow(/no change blades/)
  })
})
