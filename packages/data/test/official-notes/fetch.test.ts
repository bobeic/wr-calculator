import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { loadNotes } from '../../scripts/official-notes/fetch'
import type { LoadNotesOptions } from '../../scripts/official-notes/fetch'

const page = readFileSync(new URL('../fixtures/official-notes/7.3a.html', import.meta.url), 'utf-8')

function options(overrides: Partial<LoadNotesOptions> = {}): LoadNotesOptions {
  const dir = mkdtempSync(join(tmpdir(), 'notes-'))
  return {
    patch: '7.3a', url: 'https://example.test/7-3a', cacheFile: join(dir, 'cache', '7.3a.html'), snapshotFile: join(dir, '7.3a.json'),
    offline: false, allowFetch: false,
    fetchPage: async () => ({ status: 200, text: async () => page }),
    ...overrides,
  }
}

describe('loadNotes', () => {
  it('fetches, parses and caches the page', async () => {
    const opts = options()
    const notes = await loadNotes(opts)
    expect(notes?.entries).toHaveLength(20)
    expect(existsSync(opts.cacheFile)).toBe(true)
  })

  it('returns null on 404', async () => {
    expect(await loadNotes(options({ fetchPage: async () => ({ status: 404, text: async () => '' }) }))).toBeNull()
  })

  it('throws on other HTTP errors', async () => {
    await expect(loadNotes(options({ fetchPage: async () => ({ status: 503, text: async () => '' }) }))).rejects.toThrow(/HTTP 503/)
  })

  it('offline: reads the cache, then the committed snapshot, else null without fetching', async () => {
    const fail = async (): Promise<never> => { throw new Error('must not fetch') }
    const opts = options({ offline: true, fetchPage: fail })
    expect(await loadNotes(opts)).toBeNull()
    writeFileSync(opts.snapshotFile, JSON.stringify({ patch: '7.3a', url: 'u', title: 't', published: 'p', entries: [] }))
    expect((await loadNotes(opts))?.title).toBe('t')
  })

  it('offline with --notes-url: prefers the committed snapshot over fetching', async () => {
    const fail = async (): Promise<never> => { throw new Error('must not fetch') }
    const opts = options({ offline: true, allowFetch: true, fetchPage: fail })
    writeFileSync(opts.snapshotFile, JSON.stringify({ patch: '7.3a', url: 'u', title: 't', published: 'p', entries: [] }))
    expect((await loadNotes(opts))?.title).toBe('t')
  })

  it('offline with --notes-url: fetches', async () => {
    expect((await loadNotes(options({ offline: true, allowFetch: true })))?.entries).toHaveLength(20)
  })
})
