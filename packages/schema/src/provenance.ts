import { z } from 'zod'

export const ProvenanceSchema = z.object({
  source: z.enum(['manual', 'wiki', 'patch-notes', 'in-game']),
  patch: z.string(),
  verifiedInGame: z.boolean(),
  verifiedAt: z.string().optional(),
  /** The patch whose source data changed under this hand-modelled entry; it needs re-checking. */
  staleSince: z.string().optional(),
}).strict()
export type Provenance = z.infer<typeof ProvenanceSchema>
