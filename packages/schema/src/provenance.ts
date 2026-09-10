import { z } from 'zod'

export const ProvenanceSchema = z.object({
  source: z.enum(['manual', 'wiki', 'patch-notes', 'in-game']),
  patch: z.string(),
  verifiedInGame: z.boolean(),
  verifiedAt: z.string().optional(),
}).strict()
export type Provenance = z.infer<typeof ProvenanceSchema>
