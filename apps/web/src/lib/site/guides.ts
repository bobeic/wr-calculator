import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** One line of guide text: plain runs and **bold** runs. */
export type Inline = Array<{ text: string; bold: boolean }>
export type Block = { kind: 'p'; text: Inline } | { kind: 'ul'; items: Inline[] }
export interface GuideSection { title: string; blocks: Block[] }
export interface MatchupNote { name: string; text: Inline }
export interface Guide { sections: GuideSection[]; matchups: MatchupNote[] }

const MATCHUPS = 'matchups'

function inline(text: string): Inline {
  // split() with a capture group interleaves the bold runs: [plain, bold, plain, ...].
  return text.split(/\*\*(.+?)\*\*/).map((part, index) => ({ text: part, bold: index % 2 === 1 })).filter((part) => part.text !== '')
}

/**
 * Parses the small Markdown subset in content/guides/README.md: `## ` sections, blank-line paragraphs, `- ` bullets,
 * `**bold**`. The Matchups section's "Name: note" bullets come back separately so the page can show icons.
 */
export function parseGuide(source: string): Guide {
  const sections: GuideSection[] = []
  const matchups: MatchupNote[] = []
  let section: GuideSection | null = null
  let paragraph: string[] = []
  const flush = () => {
    if (section !== null && paragraph.length > 0) section.blocks.push({ kind: 'p', text: inline(paragraph.join(' ')) })
    paragraph = []
  }
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      flush()
      section = { title: line.slice(3).trim(), blocks: [] }
      sections.push(section)
    } else if (section === null) {
      continue // text above the first heading (a title, notes to self) isn't shown
    } else if (line === '-' || line.startsWith('- ')) {
      flush()
      const item = line.slice(1).trim()
      if (item === '') continue
      const note = /^([^:]{1,40}):\s+(.+)$/.exec(item)
      if (section.title.toLowerCase() === MATCHUPS && note) {
        matchups.push({ name: note[1].trim(), text: inline(note[2]) })
        continue
      }
      const last = section.blocks.at(-1)
      if (last?.kind === 'ul') last.items.push(inline(item))
      else section.blocks.push({ kind: 'ul', items: [inline(item)] })
    } else if (line === '') {
      flush()
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return { sections: sections.filter((entry) => entry.blocks.length > 0 && entry.title.toLowerCase() !== MATCHUPS), matchups }
}

const GUIDES_DIR = join(process.cwd(), '..', '..', 'content', 'guides')

/** The champion's guide from content/guides/<id>.md, or null when there isn't one. Server-only (build time). */
export function loadGuide(championId: string): Guide | null {
  const file = join(GUIDES_DIR, `${championId}.md`)
  if (!/^[a-z0-9-]+$/.test(championId) || !existsSync(file)) return null
  const guide = parseGuide(readFileSync(file, 'utf8'))
  return guide.sections.length === 0 && guide.matchups.length === 0 ? null : guide
}
