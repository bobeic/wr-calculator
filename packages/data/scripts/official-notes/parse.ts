import { z } from 'zod'
import type { NotesEntry, NotesLine, OfficialNotes } from './types'

const EXCLUDED_KEYWORDS = [
  'game mode', 'adventure', 'aram', 'bug fix', 'system', 'training', 'custom mode', 'battlefest',
  'recommendation', 'season theme', 'wild pass',
]

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…',
}

const BladeSchema = z.object({ type: z.string().optional() }).passthrough()
const NextDataSchema = z.object({
  props: z.object({ pageProps: z.object({ page: z.object({ blades: z.array(BladeSchema) }) }) }),
})
const MastheadSchema = z.object({ title: z.string(), publishDate: z.string() }).passthrough()
const RichTextSchema = z.object({ richText: z.object({ body: z.string() }).passthrough() }).passthrough()
const CharacterChangesSchema = z.object({
  characters: z.array(z.object({
    character: z.object({ name: z.string() }).passthrough(),
    changes: z.array(z.object({
      title: z.string().nullable().optional(),
      description: z.object({ body: z.string() }).passthrough().optional(),
    }).passthrough()),
  }).passthrough()),
}).passthrough()

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return String.fromCodePoint(point)
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

/** Turns an HTML fragment into plain text: tags removed, entities decoded, whitespace collapsed. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

// 'Label: before → after', with an optional half- or full-width colon label, either arrow, and an
// optional trailing full stop (the notes sometimes end lines with '。').
const CHANGE_LINE_RE = /^(?:(.*?)[:：]\s*)?(.+?)\s*(?:→|->)\s*(.+?)[。.]?$/

/** Splits a change line into its before and after values; nulls when it has no arrow. */
export function parseChangeLine(text: string): { before: string | null; after: string | null } {
  const match = CHANGE_LINE_RE.exec(text)
  if (match === null) return { before: null, after: null }
  return { before: match[2].trim(), after: match[3].trim() }
}

function line(group: string | null, html: string): NotesLine {
  const text = htmlToText(html)
  return { group, text, ...parseChangeLine(text) }
}

const listItems = (html: string): string[] => [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1])

const isExcluded = (heading: string): boolean => {
  const folded = heading.toLowerCase()
  return EXCLUDED_KEYWORDS.some((keyword) => folded.includes(keyword))
}

// A <p> starts a sub-group when it ends in a colon or is wholly italic/bold; other paragraphs are commentary.
const groupHeader = (html: string): string | null => {
  const text = htmlToText(html)
  if (/[:：]$/.test(text)) return text.replace(/[:：]$/, '').trim()
  if (/^\s*<(i|em|b|strong)>[\s\S]*<\/\1>\s*$/.test(html)) return text
  return null
}

/** Parses an official notes page's embedded __NEXT_DATA__ into entries; throws if the layout drifted. */
export function parseNotesPage(html: string, patch: string, url: string): OfficialNotes {
  const script = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)
  if (script === null) throw new Error(`${url}: no __NEXT_DATA__ script; the notes page layout has changed`)
  const blades = NextDataSchema.parse(JSON.parse(script[1])).props.pageProps.page.blades
  if (!blades.some((blade) => blade.type === 'characterChanges' || blade.type === 'articleRichText')) {
    throw new Error(`${url}: no change blades (characterChanges / articleRichText); the notes page layout has changed`)
  }
  let title = ''
  let published = ''
  const entries: NotesEntry[] = []
  // Section state carries across rich-text blades: a page's <h2>/<h3> structure spans several of them.
  let h2 = ''
  let h3 = ''
  for (const blade of blades) {
    if (blade.type === 'articleMasthead') {
      const masthead = MastheadSchema.parse(blade)
      title = masthead.title
      published = masthead.publishDate
    } else if (blade.type === 'characterChanges') {
      for (const { character, changes } of CharacterChangesSchema.parse(blade).characters) {
        entries.push({
          source: 'champion-blade', section: '', excluded: false, heading: htmlToText(character.name),
          lines: changes.flatMap((change) => listItems(change.description?.body ?? '')
            .map((item) => line(change.title === null || change.title === undefined ? null : htmlToText(change.title), item))),
        })
      }
    } else if (blade.type === 'articleRichText') {
      let current: NotesEntry | null = null
      let group: string | null = null
      for (const match of RichTextSchema.parse(blade).richText.body.matchAll(/<(h2|h3|h4|p|li)[^>]*>([\s\S]*?)<\/\1>/g)) {
        const [, tag, inner] = match
        if (tag === 'h2') {
          h2 = htmlToText(inner)
          h3 = ''
          current = null
        } else if (tag === 'h3') {
          h3 = htmlToText(inner)
          current = null
        } else if (tag === 'h4') {
          current = {
            source: 'rich-text', section: h3 || h2, excluded: isExcluded(h2) || isExcluded(h3),
            heading: htmlToText(inner), lines: [],
          }
          entries.push(current)
          group = null
        } else if (tag === 'p') {
          group = groupHeader(inner) ?? group
        } else if (current !== null) {
          current.lines.push(line(group, inner))
        }
      }
    }
  }
  return { patch, url, title, published, entries }
}
