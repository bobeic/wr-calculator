import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  patchConst, provenanceName, renderChangedIds, renderLayersModule, scaffoldFiles, writeMissingFiles,
} from '../../scripts/patch/scaffold'

const LAYERS_FILE = new URL('../../src/patches/layers.ts', import.meta.url).pathname

describe('names', () => {
  it('turns patch ids into constant-safe names', () => {
    expect(patchConst('7.3')).toBe('7_3')
    expect(patchConst('7.3a')).toBe('7_3A')
    expect(provenanceName('7.3a')).toBe('WRPOCKET_7_3A_PROVENANCE')
  })
})

describe('renderLayersModule', () => {
  it('reproduces the committed layers.ts for the patches it lists', async () => {
    const committed = await readFile(LAYERS_FILE, 'utf-8')
    const ids = [...committed.matchAll(/from '\.\/(.+)\/layer'/g)].map((match) => match[1])
    expect(renderLayersModule(ids)).toBe(committed)
  })

  it('imports each layer in order', () => {
    const source = renderLayersModule(['7.3', '7.3a'])
    expect(source).toContain("import { PATCH_LAYER as PATCH_7_3A } from './7.3a/layer'")
    expect(source).toContain('export const PATCH_LAYERS: PatchLayer[] = [PATCH_7_3, PATCH_7_3A]')
  })
})

describe('renderChangedIds', () => {
  it('writes a typed constant', () => {
    const source = renderChangedIds({ items: ['a'], champions: [] }, '7.3a')
    expect(source).toContain("import type { ChangedIds } from '../../overlay'")
    expect(source).toContain('export const CHANGED_IDS: ChangedIds = {\n  "items": [\n    "a"\n  ],\n  "champions": []\n}')
  })
})

describe('scaffoldFiles', () => {
  const files = scaffoldFiles('7.3a')

  it('creates the four stub files', () => {
    expect(Object.keys(files).sort()).toEqual(['layer.ts', 'overrides.ts', 'provenance.ts', 'reviewed.ts'])
    expect(files['provenance.ts']).toContain("export const WRPOCKET_7_3A_PROVENANCE: Provenance = {\n  source: 'wiki', patch: '7.3a', verifiedInGame: false,\n}")
    expect(files['layer.ts']).toContain("id: '7.3a'")
    expect(files['overrides.ts']).toContain('export const OVERRIDE_ITEMS: Item[] = []')
    expect(files['reviewed.ts']).toContain('export const REVIEWED: ReviewedEntry[] = []')
  })
})

describe('writeMissingFiles', () => {
  it('never overwrites an existing file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'scaffold-'))
    await writeFile(join(dir, 'reviewed.ts'), 'user edits')
    const created = await writeMissingFiles(dir, { 'reviewed.ts': 'stub', 'overrides.ts': 'stub' })
    expect(created).toEqual(['overrides.ts'])
    expect(await readFile(join(dir, 'reviewed.ts'), 'utf-8')).toBe('user edits')
  })
})

describe('layer.ts template', () => {
  it('merges the generated notes review into reviewed and changedIds', () => {
    const layer = scaffoldFiles('9.9')['layer.ts']
    expect(layer).toContain("import { NOTES_FLAGGED, NOTES_REVIEWED } from './generated/notes-review'")
    expect(layer).toContain('  reviewed: [...REVIEWED, ...NOTES_REVIEWED],')
    expect(layer).toContain('    items: [...CHANGED_IDS.items, ...NOTES_FLAGGED.items],')
  })
})
