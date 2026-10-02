// Node-only: exposed as `@wr-calc/data/site-loader`, never from the root entry, so browser bundles stay free of
// node: builtins. The website's server components read these committed files at build time.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { normalizeId } from './wrpocket-ids'

const DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function readJson(path: string): unknown | null {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : null
}

const NotesLineSchema = z.object({
  group: z.string().nullable(), text: z.string(), before: z.string().nullable(), after: z.string().nullable(),
})
const OfficialNotesSchema = z.object({
  patch: z.string(), url: z.string(), title: z.string(), published: z.string(),
  entries: z.array(z.object({
    section: z.string(), excluded: z.boolean(), heading: z.string(), lines: z.array(NotesLineSchema),
  }).passthrough()),
}).passthrough()
export type OfficialNotesFile = z.infer<typeof OfficialNotesSchema>

/** The official patch notes as parsed by the patch pipeline (snapshots/official-notes/<patch>.json), or null. */
export function loadOfficialNotes(patch: string): OfficialNotesFile | null {
  const raw = readJson(join(DATA_ROOT, 'snapshots', 'official-notes', `${patch}.json`))
  return raw === null ? null : OfficialNotesSchema.parse(raw)
}

const BuildImpactSchema = z.object({
  from: z.string(), to: z.string(),
  scenarios: z.array(z.object({ label: z.string(), before: z.number().nullable(), after: z.number().nullable() }).passthrough()),
  items: z.array(z.object({ id: z.string(), name: z.string(), changes: z.array(z.string()) }).passthrough()),
  newlyModelled: z.array(z.string()).optional(),
}).passthrough()
export type BuildImpactFile = z.infer<typeof BuildImpactSchema>

/** The build impact report against the previous patch (src/patches/<patch>/build-impact.json), or null. */
export function loadBuildImpact(patch: string): BuildImpactFile | null {
  const raw = readJson(join(DATA_ROOT, 'src', 'patches', patch, 'build-impact.json'))
  return raw === null ? null : BuildImpactSchema.parse(raw)
}

const Localized = z.object({ en: z.string() }).passthrough()
const SnapshotChampionSchema = z.object({
  id: z.string(), name: Localized,
  abilities: z.record(z.string(), z.object({ name: Localized, description: Localized }).passthrough()),
}).passthrough()
const SnapshotItemSchema = z.object({ id: z.string(), description: Localized }).passthrough()

// wrpocket keys its abilities by the Japanese slot names.
const ABILITY_SLOTS: Record<string, 'passive' | 'q' | 'w' | 'e' | 'r'> = {
  パッシブ: 'passive', スキル1: 'q', スキル2: 'w', スキル3: 'e', アルティメット: 'r',
}

export interface AbilityText {
  slot: 'passive' | 'q' | 'w' | 'e' | 'r'
  name: string
  description: string
}

/** Ability names and descriptions per champion id, from the patch's wrpocket snapshot (English text). */
export function loadChampionText(patch: string): Map<string, AbilityText[]> {
  const raw = readJson(join(DATA_ROOT, 'snapshots', 'wrpocket', patch, 'champions.json'))
  const order = ['passive', 'q', 'w', 'e', 'r']
  return new Map(z.array(SnapshotChampionSchema).parse(raw ?? []).map((champion) => [
    normalizeId(champion.id),
    Object.entries(champion.abilities)
      .flatMap(([key, ability]): AbilityText[] => {
        const slot = ABILITY_SLOTS[key]
        return slot === undefined ? [] : [{ slot, name: ability.name.en, description: ability.description.en }]
      })
      .sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot)),
  ]))
}

/** Item description text per item id (our ids), from the patch's wrpocket snapshot. */
export function loadItemText(patch: string): Map<string, string> {
  const raw = readJson(join(DATA_ROOT, 'snapshots', 'wrpocket', patch, 'items.json'))
  return new Map(z.array(SnapshotItemSchema).parse(raw ?? []).map((item) => [normalizeId(item.id), item.description.en]))
}
