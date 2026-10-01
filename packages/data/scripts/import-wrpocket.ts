import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WRPOCKET_7_3_PROVENANCE } from '../src/patches/7.3/provenance'
import {
  RawChampionSchema, RawChampionSummarySchema, RawItemSchema, RawMetaSchema,
} from './wrpocket/raw-schemas'
import type { RawChampion } from './wrpocket/raw-schemas'
import { mapItem } from './wrpocket/map-item'
import { mapChampion } from './wrpocket/map-champion'
import { renderModule, renderReport } from './wrpocket/render'

const BASE_URL = 'https://wrpocket.app/site_data'
const EXPECTED_PATCH = '7.3'
const REQUEST_DELAY_MS = 150
const DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(DATA_ROOT, 'src', 'patches', EXPECTED_PATCH, 'generated')

async function getJson(path: string, cacheDir: string | null): Promise<unknown> {
  const cacheFile = cacheDir === null ? null : join(cacheDir, path)
  if (cacheFile !== null && existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf-8'))
  const response = await fetch(`${BASE_URL}/${path}`)
  if (!response.ok) throw new Error(`GET ${BASE_URL}/${path} failed: HTTP ${response.status}`)
  const text = await response.text()
  if (cacheFile !== null) {
    await mkdir(dirname(cacheFile), { recursive: true })
    await writeFile(cacheFile, text)
  }
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
  return JSON.parse(text)
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh')
  // meta.json is always fetched fresh: it decides which cache folder is valid.
  const meta = RawMetaSchema.parse(await getJson('meta.json', null))
  if (meta.patch !== EXPECTED_PATCH) {
    throw new Error(`wrpocket is on patch ${meta.patch}, but this importer writes patch ${EXPECTED_PATCH}`)
  }
  // The cache folder is keyed by the site's update time, so new site data never reads stale cache.
  // --refresh re-downloads this version anyway.
  const cacheDir = join(DATA_ROOT, '.cache', 'wrpocket', `${meta.patch}-${meta.updated.replace(/[^0-9]/g, '')}`)
  if (refresh) await rm(cacheDir, { recursive: true, force: true })

  const rawItems = RawItemSchema.array().parse(await getJson('items.json', cacheDir))
  const summary = RawChampionSummarySchema.parse(await getJson('champions_summary.json', cacheDir))
  const rawChampions: RawChampion[] = []
  for (const { id } of summary) {
    rawChampions.push(RawChampionSchema.parse(await getJson(`champions/${id}.json`, cacheDir)))
  }

  const prices = new Map(rawItems.map((item) => [item.id, Number(item.price)]))
  const items = rawItems.map((raw) => ({ raw, mapped: mapItem(raw, prices, WRPOCKET_7_3_PROVENANCE) }))
  const champions = rawChampions.map((raw) => ({ raw, mapped: mapChampion(raw, WRPOCKET_7_3_PROVENANCE) }))

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(join(OUT_DIR, 'items.ts'), renderModule(
    'GENERATED_ITEMS', 'Item', items.map(({ mapped }) => mapped.value), meta, 'WRPOCKET_7_3_PROVENANCE',
  ))
  await writeFile(join(OUT_DIR, 'champions.ts'), renderModule(
    'GENERATED_CHAMPIONS', 'Champion', champions.map(({ mapped }) => mapped.value), meta, 'WRPOCKET_7_3_PROVENANCE',
  ))
  const sections = [
    ...champions.map(({ mapped }) => ({ subject: `champion ${mapped.value.id}`, notes: mapped.notes })),
    ...items.map(({ mapped }) => ({ subject: `item ${mapped.value.id}`, notes: mapped.notes })),
  ].sort((a, b) => a.subject.localeCompare(b.subject))
  const noteCount = sections.reduce((sum, section) => sum + section.notes.length, 0)
  await writeFile(join(OUT_DIR, 'IMPORT_REPORT.md'), renderReport(meta, sections, [
    `${champions.length} champions, ${items.length} items imported`,
    `${noteCount} notes below (conflicts, guesses, skipped values)`,
    'Generated items have no modeled effects (passives); only starter items in items.ts do.',
    'castTime is 0 for every ability (not in the source).',
  ]))
  console.log(`Wrote ${champions.length} champions, ${items.length} items, ${noteCount} report notes to ${OUT_DIR}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
