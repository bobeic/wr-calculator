import { z } from 'zod'

// Only the fields the importer reads; .passthrough() tolerates everything else the site adds.
const LocalizedSchema = z.object({ en: z.string() }).passthrough()

export const RawMetaSchema = z.object({
  patch: z.string(),
  updated: z.string(),
  patch_major: z.string().optional(),
  sources: z.record(z.string(), z.string()).optional(),
}).passthrough()

export const RawItemSchema = z.object({
  id: z.string(),
  name: LocalizedSchema,
  description: LocalizedSchema,
  price: z.string(),
  numeric_stats: z.record(z.string(), z.number()),
  category: LocalizedSchema,
  tier: z.string(),
  components: z.array(z.string()),
}).passthrough()

const SourceIdSchema = z.union([z.string(), z.number()]).transform(String)

export const RawRuneSchema = z.object({
  id: z.string(), name: LocalizedSchema, description: LocalizedSchema, category: LocalizedSchema,
  slot: z.number(), slot_order: z.number(), source_id: SourceIdSchema,
}).passthrough()

export const RawSpellSchema = z.object({
  id: z.string(), name: LocalizedSchema, description: LocalizedSchema, source_id: SourceIdSchema,
}).passthrough()

export const RawChampionSummarySchema = z.array(z.object({ id: z.string() }).passthrough())

const RawScalingSchema = z.object({
  type: z.string(),
  value: z.union([z.string(), z.number()]).transform(String),
}).passthrough()

const RawAbilitySchema = z.object({
  name: LocalizedSchema,
  description: LocalizedSchema,
  scaling: z.array(RawScalingSchema),
}).passthrough()

export const RawChampionSchema = z.object({
  id: z.string(),
  name: LocalizedSchema,
  stats: z.record(z.string(), z.record(z.string(), z.number())),
  abilities: z.record(z.string(), RawAbilitySchema),
}).passthrough()

export type RawMeta = z.infer<typeof RawMetaSchema>
export type RawItem = z.infer<typeof RawItemSchema>
export type RawRune = z.infer<typeof RawRuneSchema>
export type RawSpell = z.infer<typeof RawSpellSchema>
export type RawAbility = z.infer<typeof RawAbilitySchema>
export type RawChampion = z.infer<typeof RawChampionSchema>
