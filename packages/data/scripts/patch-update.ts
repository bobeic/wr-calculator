import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Provenance } from '@wr-calc/schema'
import { loadGoldenCases } from '../src/golden-loader'
import { getPatchDataset } from '../src/patches/registry'
import type { ReviewedEntry } from '../src/patches/overlay'
import { changedIdsOf, diffSnapshots } from './patch/diff'
import { mapSnapshot } from './patch/map-snapshot'
import { buildPatchDiff, goldenRefs } from './patch/patch-diff'
import { renderPatchDiff } from './patch/render-diff'
import { metaFromCacheDir, planRun, stripGeneratorHeader } from './patch/run-plan'
import type { RunPlan } from './patch/run-plan'
import {
  provenanceName, renderChangedIds, renderLayersModule, scaffoldFiles, writeMissingFiles,
} from './patch/scaffold'
import { buildSnapshot, trimMeta } from './patch/snapshot'
import type { Snapshot, SnapshotMeta } from './patch/snapshot'
import { listSnapshotMetas, readSnapshot, writeSnapshot } from './patch/snapshot-io'
import { stableStringify } from './patch/stable-json'
import type { IdLists, StaleRef } from './patch/types'
import {
  RawChampionSchema, RawChampionSummarySchema, RawItemSchema, RawMetaSchema,
} from './wrpocket/raw-schemas'
import type { RawChampion } from './wrpocket/raw-schemas'
import { renderModule, renderReport } from './wrpocket/render'

const BASE_URL = 'https://wrpocket.app/site_data'
const REQUEST_DELAY_MS = 150
const DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT_ROOT = join(DATA_ROOT, 'snapshots', 'wrpocket')
const PATCHES_DIR = join(DATA_ROOT, 'src', 'patches')
const GOLDEN_DIR = join(DATA_ROOT, 'golden')
// Inside the package so the final renames stay on one filesystem.
const STAGING_DIR = join(DATA_ROOT, '.cache', 'patch-update-staging')
const GENERATED_FILES = ['items.ts', 'champions.ts', 'IMPORT_REPORT.md']

interface Options {
  refresh: boolean
  fromCache: string | null
}

function parseArgs(argv: string[]): Options {
  const index = argv.indexOf('--from-cache')
  if (index !== -1 && argv[index + 1] === undefined) throw new Error('--from-cache needs a folder')
  return { refresh: argv.includes('--refresh'), fromCache: index === -1 ? null : argv[index + 1] }
}

/** Reads one site_data file from the cache, fetching it first unless offline. */
async function getJson(path: string, cacheDir: string, offline: boolean): Promise<unknown> {
  const cacheFile = join(cacheDir, path)
  if (existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf-8'))
  if (offline) throw new Error(`${cacheFile} is missing from the cache`)
  const response = await fetch(`${BASE_URL}/${path}`)
  if (!response.ok) throw new Error(`GET ${BASE_URL}/${path} failed: HTTP ${response.status}`)
  const text = await response.text()
  await mkdir(dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, text)
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
  return JSON.parse(text)
}

/** Fetches meta.json fresh every run: it decides which cache folder is valid. */
async function fetchMeta(): Promise<SnapshotMeta> {
  const response = await fetch(`${BASE_URL}/meta.json`)
  if (!response.ok) throw new Error(`GET ${BASE_URL}/meta.json failed: HTTP ${response.status}`)
  return trimMeta(RawMetaSchema.parse(await response.json()))
}

async function fetchSnapshot(meta: SnapshotMeta, cacheDir: string, offline: boolean): Promise<Snapshot> {
  const items = RawItemSchema.array().parse(await getJson('items.json', cacheDir, offline))
  const summary = RawChampionSummarySchema.parse(await getJson('champions_summary.json', cacheDir, offline))
  const champions: RawChampion[] = []
  for (const { id } of summary) {
    champions.push(RawChampionSchema.parse(await getJson(`champions/${id}.json`, cacheDir, offline)))
  }
  return buildSnapshot(meta, items, champions)
}

async function readCovered(patchDir: string): Promise<IdLists> {
  const overridesFile = join(patchDir, 'overrides.ts')
  const reviewedFile = join(patchDir, 'reviewed.ts')
  if (!existsSync(overridesFile) || !existsSync(reviewedFile)) return { items: [], champions: [] }
  const overrides = await import(pathToFileURL(overridesFile).href) as { OVERRIDE_ITEMS: Array<{ id: string }>; OVERRIDE_CHAMPIONS: Array<{ id: string }> }
  const { REVIEWED } = await import(pathToFileURL(reviewedFile).href) as { REVIEWED: ReviewedEntry[] }
  return {
    items: [...overrides.OVERRIDE_ITEMS.map((entry) => entry.id), ...REVIEWED.filter((entry) => entry.kind === 'item').map((entry) => entry.id)],
    champions: [...overrides.OVERRIDE_CHAMPIONS.map((entry) => entry.id), ...REVIEWED.filter((entry) => entry.kind === 'champion').map((entry) => entry.id)],
  }
}

function previousStale(previous: string): StaleRef[] {
  const dataset = getPatchDataset(previous)
  const refs = (kind: StaleRef['kind'], stale: Map<string, string>, entries: Array<{ id: string; name: string }>): StaleRef[] =>
    [...stale].map(([id, since]) => ({ kind, id, since, name: entries.find((entry) => entry.id === id)?.name ?? id }))
  return [
    ...refs('item', dataset.stale.items, dataset.handModelled.items),
    ...refs('champion', dataset.stale.champions, dataset.handModelled.champions),
  ]
}

/** Compares the staged generated files with the committed ones, ignoring generator-name header lines. */
async function checkDeterminism(stagedDir: string, patchDir: string): Promise<void> {
  const differing: string[] = []
  for (const name of GENERATED_FILES) {
    const staged = await readFile(join(stagedDir, name), 'utf-8')
    const committed = await readFile(join(patchDir, 'generated', name), 'utf-8')
    if (stripGeneratorHeader(staged) !== stripGeneratorHeader(committed)) differing.push(name)
  }
  if (differing.length > 0) {
    throw new Error(`regenerating from the cache does not reproduce the committed files: ${differing.join(', ')}. `
      + `Diff ${stagedDir} against ${join(patchDir, 'generated')}; nothing was written.`)
  }
}

async function replaceWith(staged: string, target: string): Promise<void> {
  await rm(target, { recursive: true, force: true })
  await mkdir(dirname(target), { recursive: true })
  await rename(staged, target)
}

async function run(options: Options): Promise<void> {
  const meta: SnapshotMeta = options.fromCache === null ? await fetchMeta() : metaFromCacheDir(options.fromCache)
  const known = await listSnapshotMetas(SNAPSHOT_ROOT)
  const plan: RunPlan = planRun(meta, known, options.refresh)
  if (plan.kind === 'up-to-date') {
    console.log(`Patch ${plan.patch} is up to date (wrpocket updated ${meta.updated}); nothing written.`)
    return
  }
  const patchDir = join(PATCHES_DIR, plan.patch)
  if (plan.kind === 'bootstrap' && !existsSync(join(patchDir, 'layer.ts'))) {
    throw new Error(`bootstrapping ${plan.patch} needs an existing root layer at ${join(patchDir, 'layer.ts')}`)
  }
  const cacheDir = options.fromCache ?? join(DATA_ROOT, '.cache', 'wrpocket', `${meta.patch}-${meta.updated.replace(/[^0-9]/g, '')}`)
  if (options.fromCache === null && options.refresh) await rm(cacheDir, { recursive: true, force: true })
  const snapshot = await fetchSnapshot(meta, cacheDir, options.fromCache !== null)

  const provenance: Provenance = { source: 'wiki', patch: plan.patch, verifiedInGame: false }
  const constName = provenanceName(plan.patch)

  await rm(STAGING_DIR, { recursive: true, force: true })
  const staged = { snapshot: join(STAGING_DIR, 'snapshot'), generated: join(STAGING_DIR, 'generated'), reports: join(STAGING_DIR, 'reports') }
  await writeSnapshot(staged.snapshot, snapshot)
  // The on-disk snapshot is the single source of truth: map what was committed, not the in-memory copy.
  const committed = await readSnapshot(staged.snapshot)
  const mapped = mapSnapshot(committed, provenance)
  await mkdir(staged.generated, { recursive: true })
  await mkdir(staged.reports, { recursive: true })
  await writeFile(join(staged.generated, 'items.ts'), renderModule('GENERATED_ITEMS', 'Item', mapped.items, committed.meta, constName))
  await writeFile(join(staged.generated, 'champions.ts'), renderModule('GENERATED_CHAMPIONS', 'Champion', mapped.champions, committed.meta, constName))
  const subjects = [...new Set(mapped.notes.map((note) => note.subject))]
  await writeFile(join(staged.generated, 'IMPORT_REPORT.md'), renderReport(committed.meta,
    subjects.map((subject) => ({ subject, notes: mapped.notes.filter((note) => note.subject === subject).map((note) => note.note) })), [
      `${mapped.champions.length} champions, ${mapped.items.length} items imported`,
      `${mapped.notes.length} notes below (conflicts, guesses, skipped values)`,
      'Generated items have no modeled effects (passives); only starter items in items.ts do.',
      'castTime is 0 for every ability (not in the source).',
    ]))

  const previous = plan.kind === 'bootstrap' ? null : plan.previous
  let needsReview = 0
  if (previous !== null) {
    const before = await readSnapshot(join(SNAPSHOT_ROOT, previous))
    const dataset = getPatchDataset(previous)
    const diff = buildPatchDiff({
      before, after: committed,
      handModelled: { items: dataset.handModelled.items.map((item) => item.id), champions: dataset.handModelled.champions.map((champion) => champion.id) },
      previousStale: previousStale(previous),
      covered: await readCovered(patchDir),
      goldens: goldenRefs(loadGoldenCases(GOLDEN_DIR)),
      notesBefore: mapSnapshot(before, provenance).notes,
      notesAfter: mapped.notes,
    })
    needsReview = diff.needsReview.length
    await writeFile(join(staged.generated, 'changed-ids.ts'), renderChangedIds(changedIdsOf(diffSnapshots(before, committed)), plan.patch))
    await writeFile(join(staged.reports, 'patch-diff.json'), stableStringify(diff))
    await writeFile(join(staged.reports, 'PATCH_DIFF.md'), renderPatchDiff(diff))
  }
  if (options.fromCache !== null && existsSync(join(patchDir, 'generated'))) {
    await checkDeterminism(staged.generated, patchDir)
  }

  // Every stage succeeded: move the staged output into place.
  await replaceWith(staged.snapshot, join(SNAPSHOT_ROOT, plan.patch))
  await replaceWith(staged.generated, join(patchDir, 'generated'))
  if (previous !== null) {
    await rename(join(staged.reports, 'patch-diff.json'), join(patchDir, 'patch-diff.json'))
    await rename(join(staged.reports, 'PATCH_DIFF.md'), join(patchDir, 'PATCH_DIFF.md'))
    const created = await writeMissingFiles(patchDir, scaffoldFiles(plan.patch))
    if (created.length > 0) console.log(`Created ${created.join(', ')} in ${patchDir}`)
  }
  const ids = (await listSnapshotMetas(SNAPSHOT_ROOT)).map((entry) => entry.patch)
  await writeFile(join(PATCHES_DIR, 'layers.ts'), renderLayersModule(ids))
  await rm(STAGING_DIR, { recursive: true, force: true })

  console.log(`${plan.kind} ${plan.patch}: ${mapped.champions.length} champions, ${mapped.items.length} items, ${mapped.notes.length} mapper notes.`)
  if (previous !== null) console.log(`Diff against ${previous}: ${needsReview} hand-modelled entries need review. See ${join(patchDir, 'PATCH_DIFF.md')}`)
}

run(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
