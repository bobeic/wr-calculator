import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stableStringify } from '../../scripts/patch/stable-json'
import { buildSnapshot, trimChampion, trimItem, trimMeta } from '../../scripts/patch/snapshot'
import { listSnapshotMetas, readSnapshot, writeSnapshot } from '../../scripts/patch/snapshot-io'
import { makeRawChampion, makeRawItem } from './fixtures'

describe('stableStringify', () => {
  it('sorts keys at every level, indents by 2 and ends with a newline', () => {
    expect(stableStringify({ b: 1, a: { d: [{ z: 1, y: 2 }], c: 3 } }))
      .toBe('{\n  "a": {\n    "c": 3,\n    "d": [\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n')
  })

  it('keeps array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[\n  3,\n  1,\n  2\n]\n')
  })
})

describe('trim', () => {
  it('keeps only the item fields the mapper and diff use', () => {
    expect(trimItem(makeRawItem())).toEqual({
      id: 'long-sword', name: { en: 'Long Sword' }, description: { en: '+12 Attack Damage' },
      price: '500', tier: 'basic', category: { en: 'Physical' }, components: [],
      numeric_stats: { attackDamage: 12 },
    })
  })

  it('keeps champion stats and ability name, text and scaling only', () => {
    const trimmed = trimChampion(makeRawChampion())
    expect(Object.keys(trimmed).sort()).toEqual(['abilities', 'id', 'name', 'stats'])
    expect(trimmed.name).toEqual({ en: 'Annie' })
    expect(trimmed.stats['レベル15'].体力).toBe(1900)
    expect(trimmed.abilities['スキル1']).toEqual({
      name: { en: 'Disintegrate' },
      description: { en: 'Disintegrate deals 80 / 130 / 180 / 230 (+85% AP) magic damage.' },
      scaling: [{ type: 'cd', value: '4/4/4/4' }, { type: 'MP', value: '50/55/60/65' }],
    })
  })

  it('keeps optional meta fields only when present', () => {
    expect(trimMeta({ patch: '7.3', updated: '2026-09-23 10:19:27' }))
      .toEqual({ patch: '7.3', updated: '2026-09-23 10:19:27' })
    expect(trimMeta({
      patch: '7.3a', updated: 'u', patch_major: '7.3', sources: { items: 'i' }, extra: 1,
    })).toEqual({ patch: '7.3a', updated: 'u', patch_major: '7.3', sources: { items: 'i' } })
  })

  it('sorts items and champions by id', () => {
    const snapshot = buildSnapshot(
      { patch: '7.3', updated: 'u' },
      [makeRawItem({ id: 'b' }), makeRawItem({ id: 'a' })],
      [makeRawChampion({ id: 'zed' }), makeRawChampion({ id: 'annie' })],
    )
    expect(snapshot.items.map((item) => item.id)).toEqual(['a', 'b'])
    expect(snapshot.champions.map((champion) => champion.id)).toEqual(['annie', 'zed'])
  })
})

describe('snapshot io', () => {
  it('round-trips a snapshot through stable JSON files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'snapshot-'))
    const snapshot = buildSnapshot({ patch: '7.3', updated: 'u' }, [makeRawItem()], [makeRawChampion()])
    await writeSnapshot(join(root, '7.3'), snapshot)
    expect(await readSnapshot(join(root, '7.3'))).toEqual(snapshot)
    expect(await readFile(join(root, '7.3', 'items.json'), 'utf-8')).toBe(stableStringify(snapshot.items))
  })

  it('lists metas oldest first, and [] for a missing root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'snapshot-'))
    const empty = { items: [], champions: [] }
    await writeSnapshot(join(root, '7.3a'), { meta: { patch: '7.3a', updated: '2026-09-29 16:09:43' }, ...empty })
    await writeSnapshot(join(root, '7.3'), { meta: { patch: '7.3', updated: '2026-09-23 10:19:27' }, ...empty })
    expect((await listSnapshotMetas(root)).map((meta) => meta.patch)).toEqual(['7.3', '7.3a'])
    expect(await listSnapshotMetas(join(root, 'missing'))).toEqual([])
  })

  it('rejects when root is a file, not a directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'snapshot-'))
    const filePath = join(root, 'file-not-dir')
    await writeFile(filePath, 'content')
    await expect(listSnapshotMetas(filePath)).rejects.toThrow()
  })
})
