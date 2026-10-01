import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import { parseNotesPage } from './parse'
import type { OfficialNotes } from './types'

export interface LoadNotesOptions {
  patch: string
  url: string
  /** Raw page cache file, e.g. .cache/official-notes/7.3a.html */
  cacheFile: string
  /** Committed parsed snapshot, e.g. snapshots/official-notes/7.3a.json */
  snapshotFile: string
  /** --from-cache run: don't fetch unless allowFetch. */
  offline: boolean
  /** True when --notes-url was given: an offline run may fetch then. */
  allowFetch: boolean
  fetchPage: (url: string) => Promise<{ status: number; text: () => Promise<string> }>
}

const NotesLineSchema = z.object({ group: z.string().nullable(), text: z.string(), before: z.string().nullable(), after: z.string().nullable() })
const OfficialNotesSchema = z.object({
  patch: z.string(), url: z.string(), title: z.string(), published: z.string(),
  entries: z.array(z.object({
    source: z.enum(['champion-blade', 'rich-text']), section: z.string(), excluded: z.boolean(), heading: z.string(), lines: z.array(NotesLineSchema),
  })),
})

/** Loads the official notes from the page cache, the committed snapshot or the web; null if not published. */
export async function loadNotes(options: LoadNotesOptions): Promise<OfficialNotes | null> {
  if (existsSync(options.cacheFile)) return parseNotesPage(readFileSync(options.cacheFile, 'utf-8'), options.patch, options.url)
  if (options.offline && !options.allowFetch) {
    if (!existsSync(options.snapshotFile)) return null
    return OfficialNotesSchema.parse(JSON.parse(readFileSync(options.snapshotFile, 'utf-8')))
  }
  const response = await options.fetchPage(options.url)
  if (response.status === 404) return null
  if (response.status < 200 || response.status >= 300) throw new Error(`GET ${options.url} failed: HTTP ${response.status}`)
  const html = await response.text()
  // Parse before caching, so a drifted page never lands in the cache as if it were good.
  const notes = parseNotesPage(html, options.patch, options.url)
  await mkdir(dirname(options.cacheFile), { recursive: true })
  await writeFile(options.cacheFile, html)
  return notes
}
