import { z } from 'zod'
import type { RawChampion, RawItem, RawMeta, RawRune, RawSpell } from '../wrpocket/raw-schemas'

const EnSchema = z.object({ en: z.string() }).strict()

export const SnapshotMetaSchema = z.object({
  patch: z.string(),
  updated: z.string(),
  patch_major: z.string().optional(),
  sources: z.record(z.string(), z.string()).optional(),
}).strict()

export const SnapshotItemSchema = z.object({
  id: z.string(), name: EnSchema, description: EnSchema, price: z.string(), tier: z.string(),
  category: EnSchema, components: z.array(z.string()), numeric_stats: z.record(z.string(), z.number()),
}).strict()

const SnapshotAbilitySchema = z.object({
  name: EnSchema, description: EnSchema,
  scaling: z.array(z.object({ type: z.string(), value: z.string() }).strict()),
}).strict()

export const SnapshotChampionSchema = z.object({
  id: z.string(), name: EnSchema,
  stats: z.record(z.string(), z.record(z.string(), z.number())),
  abilities: z.record(z.string(), SnapshotAbilitySchema),
}).strict()

export const SnapshotRuneSchema = z.object({
  id: z.string(), name: EnSchema, description: EnSchema, category: EnSchema,
  slot: z.number(), slot_order: z.number(), source_id: z.string(),
}).strict()

export const SnapshotSpellSchema = z.object({
  id: z.string(), name: EnSchema, description: EnSchema, source_id: z.string(),
}).strict()

export type SnapshotMeta = z.infer<typeof SnapshotMetaSchema>
export type SnapshotItem = z.infer<typeof SnapshotItemSchema>
export type SnapshotAbility = z.infer<typeof SnapshotAbilitySchema>
export type SnapshotChampion = z.infer<typeof SnapshotChampionSchema>
export type SnapshotRune = z.infer<typeof SnapshotRuneSchema>
export type SnapshotSpell = z.infer<typeof SnapshotSpellSchema>

/** One patch's trimmed wrpocket data: the single source of truth for that patch's generated files. */
export interface Snapshot {
  meta: SnapshotMeta
  items: SnapshotItem[]
  champions: SnapshotChampion[]
  /** Runes and summoner spells; absent from snapshots taken before the pipeline imported them (7.3). */
  runes?: SnapshotRune[]
  spells?: SnapshotSpell[]
}

/** Keeps the meta fields worth recording; the optional ones only when the site sends them. */
export function trimMeta(raw: RawMeta): SnapshotMeta {
  return {
    patch: raw.patch, updated: raw.updated,
    ...(raw.patch_major === undefined ? {} : { patch_major: raw.patch_major }),
    ...(raw.sources === undefined ? {} : { sources: { ...raw.sources } }),
  }
}

/** Keeps the item fields the mapper consumes or the diff compares. */
export function trimItem(raw: RawItem): SnapshotItem {
  return {
    id: raw.id, name: { en: raw.name.en }, description: { en: raw.description.en }, price: raw.price,
    tier: raw.tier, category: { en: raw.category.en }, components: [...raw.components],
    numeric_stats: { ...raw.numeric_stats },
  }
}

/** Keeps the champion's per-level stats and each ability's name, text and scaling rows. */
export function trimChampion(raw: RawChampion): SnapshotChampion {
  return {
    id: raw.id, name: { en: raw.name.en },
    stats: Object.fromEntries(Object.entries(raw.stats).map(([level, row]) => [level, { ...row }])),
    abilities: Object.fromEntries(Object.entries(raw.abilities).map(([key, ability]) => [key, {
      name: { en: ability.name.en }, description: { en: ability.description.en },
      scaling: ability.scaling.map(({ type, value }) => ({ type, value })),
    }])),
  }
}

export function trimRune(raw: RawRune): SnapshotRune {
  return {
    id: raw.id, name: { en: raw.name.en }, description: { en: raw.description.en }, category: { en: raw.category.en },
    slot: raw.slot, slot_order: raw.slot_order, source_id: raw.source_id,
  }
}

export function trimSpell(raw: RawSpell): SnapshotSpell {
  return { id: raw.id, name: { en: raw.name.en }, description: { en: raw.description.en }, source_id: raw.source_id }
}

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Trims validated raw responses into a snapshot with every list sorted by id. */
export function buildSnapshot(
  meta: RawMeta, items: RawItem[], champions: RawChampion[], runes: RawRune[] = [], spells: RawSpell[] = [],
): Snapshot {
  return {
    meta: trimMeta(meta),
    items: items.map(trimItem).sort(byId),
    champions: champions.map(trimChampion).sort(byId),
    runes: runes.map(trimRune).sort(byId),
    spells: spells.map(trimSpell).sort(byId),
  }
}
