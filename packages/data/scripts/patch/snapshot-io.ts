import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stableStringify } from './stable-json'
import {
  SnapshotChampionSchema, SnapshotItemSchema, SnapshotMetaSchema, SnapshotRuneSchema, SnapshotSpellSchema,
} from './snapshot'
import type { Snapshot, SnapshotMeta } from './snapshot'

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf-8'))
}

/** Writes meta.json, items.json, champions.json and (when present) runes.json and spells.json as stable JSON. */
export async function writeSnapshot(dir: string, snapshot: Snapshot): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'meta.json'), stableStringify(snapshot.meta))
  await writeFile(join(dir, 'items.json'), stableStringify(snapshot.items))
  await writeFile(join(dir, 'champions.json'), stableStringify(snapshot.champions))
  if (snapshot.runes !== undefined) await writeFile(join(dir, 'runes.json'), stableStringify(snapshot.runes))
  if (snapshot.spells !== undefined) await writeFile(join(dir, 'spells.json'), stableStringify(snapshot.spells))
}

/** Reads and validates a snapshot folder. */
export async function readSnapshot(dir: string): Promise<Snapshot> {
  return {
    meta: SnapshotMetaSchema.parse(await readJson(join(dir, 'meta.json'))),
    items: SnapshotItemSchema.array().parse(await readJson(join(dir, 'items.json'))),
    champions: SnapshotChampionSchema.array().parse(await readJson(join(dir, 'champions.json'))),
    ...(existsSync(join(dir, 'runes.json')) && { runes: SnapshotRuneSchema.array().parse(await readJson(join(dir, 'runes.json'))) }),
    ...(existsSync(join(dir, 'spells.json')) && { spells: SnapshotSpellSchema.array().parse(await readJson(join(dir, 'spells.json'))) }),
  }
}

/** Lists every snapshot's meta under root, oldest `updated` first; a missing root gives []. */
export async function listSnapshotMetas(root: string): Promise<SnapshotMeta[]> {
  let names: string[]
  try {
    names = await readdir(root)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const metas = await Promise.all(
    names.map(async (name) => SnapshotMetaSchema.parse(await readJson(join(root, name, 'meta.json')))),
  )
  return metas.sort((a, b) => (a.updated < b.updated ? -1 : a.updated > b.updated ? 1 : 0))
}
